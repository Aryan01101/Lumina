/**
 * Retrieval Pipeline Benchmark
 *
 * Measures latency breakdown for the RAG pipeline:
 * - Query embedding (Ollama)
 * - Vector KNN search (sqlite-vec)
 * - BM25 search (FTS5)
 * - Cross-encoder reranking (ONNX worker)
 *
 * Run: npx tsx scripts/benchmark-retrieval.ts
 */

import Database from 'better-sqlite3'
import { join } from 'path'
import { homedir } from 'os'
import { embedText } from '../src/main/memory/embedder'
import { fetchVectorCandidates, fetchFtsCandidates, mergeCandidates } from '../src/main/memory/retrieval'
import { rerankCandidates, initReranker } from '../src/main/memory/reranker'

// Use production database (macOS)
const DB_PATH = process.env.DB_PATH || join(homedir(), 'Library', 'Application Support', 'Lumina', 'lumina.db')
const NUM_RUNS = 10

interface BenchmarkResult {
  embedding: number[]
  vectorSearch: number[]
  ftsSearch: number[]
  reranking: number[]
  total: number[]
}

async function benchmarkRetrieval(db: Database.Database, query: string): Promise<BenchmarkResult> {
  const results: BenchmarkResult = {
    embedding: [],
    vectorSearch: [],
    ftsSearch: [],
    reranking: [],
    total: []
  }

  console.log(`\nBenchmarking query: "${query}"`)
  console.log('─'.repeat(60))

  for (let i = 0; i < NUM_RUNS; i++) {
    const totalStart = Date.now()

    // Stage 1a: Embedding
    const embStart = Date.now()
    const queryEmbedding = await embedText(query)
    const embTime = Date.now() - embStart
    results.embedding.push(embTime)

    // Stage 1b: Vector search
    const vecStart = Date.now()
    const vecCandidates = fetchVectorCandidates(db, queryEmbedding, 20, true)
    const vecTime = Date.now() - vecStart
    results.vectorSearch.push(vecTime)

    // Stage 1c: FTS search
    const ftsStart = Date.now()
    const ftsCandidates = fetchFtsCandidates(db, query, 20)
    const ftsTime = Date.now() - ftsStart
    results.ftsSearch.push(ftsTime)

    // Merge candidates
    const candidates = mergeCandidates(vecCandidates, ftsCandidates, 30)

    // Stage 2: Reranking
    let rerankTime = 0
    if (candidates.length > 0) {
      const texts = candidates.map((c) => String(c.content || ''))
      const rerankStart = Date.now()
      await rerankCandidates(query, texts)
      rerankTime = Date.now() - rerankStart
    }
    results.reranking.push(rerankTime)

    const totalTime = Date.now() - totalStart
    results.total.push(totalTime)

    console.log(`Run ${i + 1}: ${totalTime}ms (emb: ${embTime}ms, vec: ${vecTime}ms, fts: ${ftsTime}ms, rerank: ${rerankTime}ms)`)
  }

  return results
}

function printStats(name: string, values: number[]): void {
  const sorted = [...values].sort((a, b) => a - b)
  const p50 = sorted[Math.floor(sorted.length * 0.5)]
  const p95 = sorted[Math.floor(sorted.length * 0.95)]
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  const min = Math.min(...values)
  const max = Math.max(...values)

  console.log(`${name.padEnd(20)} min: ${min.toFixed(0)}ms  p50: ${p50.toFixed(0)}ms  p95: ${p95.toFixed(0)}ms  avg: ${avg.toFixed(1)}ms  max: ${max.toFixed(0)}ms`)
}

async function main() {
  console.log('🔍 Retrieval Pipeline Benchmark')
  console.log('═'.repeat(60))

  // Check if DB exists
  const db = new Database(DB_PATH)

  // Check if sqlite-vec is available
  let vecAvailable = false
  try {
    db.exec('SELECT vec_version()')
    vecAvailable = true
    console.log('✓ sqlite-vec available')
  } catch {
    console.log('✗ sqlite-vec NOT available')
  }

  // Check chunk count
  const chunkCount = db.prepare('SELECT COUNT(*) as count FROM memory_chunks').get() as { count: number }
  console.log(`✓ Found ${chunkCount.count} chunks in database`)

  if (chunkCount.count === 0) {
    console.log('\n⚠️  No data in database. Add journal entries first.')
    process.exit(1)
  }

  // Initialize reranker
  initReranker(process.cwd())

  // Benchmark queries
  const queries = [
    'user working on AI projects',
    'feeling stressed about deadlines',
    'celebrating a milestone achievement'
  ]

  const allResults: BenchmarkResult[] = []

  for (const query of queries) {
    const result = await benchmarkRetrieval(db, query)
    allResults.push(result)
  }

  // Print aggregate stats
  console.log('\n')
  console.log('📊 Aggregate Statistics (across all queries)')
  console.log('═'.repeat(60))

  const allEmbedding = allResults.flatMap(r => r.embedding)
  const allVectorSearch = allResults.flatMap(r => r.vectorSearch)
  const allFtsSearch = allResults.flatMap(r => r.ftsSearch)
  const allReranking = allResults.flatMap(r => r.reranking)
  const allTotal = allResults.flatMap(r => r.total)

  printStats('Query Embedding', allEmbedding)
  printStats('Vector Search', allVectorSearch)
  printStats('FTS Search', allFtsSearch)
  printStats('Reranking', allReranking)
  console.log('─'.repeat(60))
  printStats('TOTAL', allTotal)

  console.log('\n')

  const p50Total = [...allTotal].sort((a, b) => a - b)[Math.floor(allTotal.length * 0.5)]
  if (p50Total < 250) {
    console.log(`✅ SUCCESS: p50 latency ${p50Total}ms < 250ms target`)
  } else {
    console.log(`⚠️  MISS: p50 latency ${p50Total}ms > 250ms target`)
    console.log(`   Main bottleneck: ${
      Math.max(...allEmbedding) > Math.max(...allReranking)
        ? 'Query embedding (Ollama)'
        : 'Cross-encoder reranking (ONNX)'
    }`)
  }

  db.close()
}

main().catch(console.error)

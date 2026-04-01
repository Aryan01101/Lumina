/**
 * Memory Engine — Phase 4
 *
 * Public API for the full ingestion and retrieval pipeline:
 *
 *   ingestEntry()          — chunk → store → background embed
 *   retrieveRelevant()     — embed query → KNN + FTS5 → rerank → top-K
 *   retryPendingEmbeddings() — on launch, retry any embedding_status='pending' chunks
 *   initMemoryEngine()     — start retention schedules, init reranker
 *
 * All operations are non-blocking:
 *   - DB inserts are synchronous (better-sqlite3, fast)
 *   - Embedding runs in background via setImmediate
 *   - Reranking runs in a worker thread
 */

import { app } from 'electron'
import { createHash } from 'crypto'
import { getDb, vecAvailable } from '../db'
import { chunkText } from './chunker'
import { embedText } from './embedder'
import { fetchVectorCandidates, fetchFtsCandidates, mergeCandidates, incrementRetrievalCount } from './retrieval'
import { initReranker, rerankCandidates } from './reranker'
import { checkChunkCap, purgeOldMessages, purgeOldSessions, scheduleWeeklyRebuild } from './retention'

// Re-export types for consumers (CCM, agent, IPC)
export interface MemoryChunk {
  id: number
  sourceType: 'journal' | 'conversation' | 'summary'
  sourceId: number
  content: string
  importanceScore: number
  similarityScore?: number
  rerankerScore?: number
  createdAt: string
}

export interface RetrievalResult {
  chunks: MemoryChunk[]
  durationMs: number
}

/** Emotional content heuristic — boosts importance score for emotionally significant entries. */
const EMOTIONAL_PATTERN =
  /\b(anxious|excited|scared|proud|happy|sad|frustrated|overwhelmed|grateful|hopeful|angry|depressed|joyful|worried|nervous|confident|lonely|loved|lost|inspired)\b/i

function computeImportanceScore(
  content: string,
  mode?: 'prompted' | 'freeform',
  sourceType?: string
): number {
  let score = 0.5

  // Recency bonus — always true at ingest, so always +0.2 for fresh entries
  score += 0.2

  // Emotional content
  if (EMOTIONAL_PATTERN.test(content)) {
    score += 0.2
  }

  // User-initiated (free-form journal or direct conversation)
  if (mode === 'freeform' || sourceType === 'conversation') {
    score += 0.1
  }

  return Math.min(1.0, score)
}

interface PendingChunk {
  id: number
  content: string
}

/** Write embedding to memory_vec and mark chunk as indexed. */
function storeEmbedding(chunkId: number, embedding: Float32Array): void {
  const db = getDb()
  if (!vecAvailable) return

  try {
    const buf = Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength)
    // sqlite-vec vec0 requires BigInt for rowid binding (Number is bound as REAL by better-sqlite3)
    db.prepare(`INSERT OR REPLACE INTO memory_vec(rowid, embedding) VALUES (?, ?)`).run(
      BigInt(chunkId),
      buf
    )
  } catch (err) {
    console.warn(`[Memory] Failed to store vector for chunk ${chunkId}:`, (err as Error).message)
    throw err // let caller handle status update
  }
}

/** Embed all provided chunks in the background. Does not block the caller. */
async function embedChunksInBackground(chunks: PendingChunk[]): Promise<void> {
  const db = getDb()

  for (const chunk of chunks) {
    const embedding = await embedText(chunk.content)

    if (embedding) {
      try {
        storeEmbedding(chunk.id, embedding)
        db.prepare(`UPDATE memory_chunks SET embedding_status = 'indexed' WHERE id = ?`).run(
          chunk.id
        )
      } catch {
        db.prepare(`UPDATE memory_chunks SET embedding_status = 'failed' WHERE id = ?`).run(
          chunk.id
        )
      }
    } else {
      // Ollama unavailable — schedule a single retry in 30s
      setTimeout(() => {
        embedText(chunk.content)
          .then((retryEmbedding) => {
            if (retryEmbedding) {
              try {
                storeEmbedding(chunk.id, retryEmbedding)
                db.prepare(
                  `UPDATE memory_chunks SET embedding_status = 'indexed' WHERE id = ?`
                ).run(chunk.id)
              } catch {
                // Leave as pending for next launch retry
              }
            }
          })
          .catch(() => {
            // Leave as pending — will retry on next launch
          })
      }, 30_000)
    }
  }
}

/**
 * Ingest a journal entry or conversation turn into memory.
 *
 * Chunks are stored immediately (synchronous). Embedding runs in background.
 */
export async function ingestEntry(
  sourceType: 'journal' | 'conversation' | 'summary',
  sourceId: number,
  content: string,
  mode?: 'prompted' | 'freeform'
): Promise<void> {
  const db = getDb()
  const chunks = chunkText(content)

  if (chunks.length === 0) return

  const importanceScore = computeImportanceScore(content, mode, sourceType)

  const insertChunk = db.prepare(
    `INSERT INTO memory_chunks
       (source_type, source_id, chunk_index, content, importance_score, embedding_status)
     VALUES (?, ?, ?, ?, ?, 'pending')`
  )

  const insertFts = db.prepare(
    `INSERT INTO memory_chunks_fts(rowid, content) VALUES (?, ?)`
  )

  const pendingChunks: PendingChunk[] = []

  const insertAll = db.transaction(() => {
    chunks.forEach((chunkContent, index) => {
      const result = insertChunk.run(sourceType, sourceId, index, chunkContent, importanceScore)
      const id = result.lastInsertRowid as number
      insertFts.run(id, chunkContent) // keep FTS5 content table in sync
      pendingChunks.push({ id, content: chunkContent })
    })
  })

  insertAll()

  console.log(`[Memory] Ingested ${chunks.length} chunk(s) from ${sourceType}:${sourceId}`)

  // Background embedding — returns immediately to IPC handler
  setImmediate(() => {
    embedChunksInBackground(pendingChunks).catch((err) => {
      console.error('[Memory] Background embedding error:', err)
    })
  })

  // Enforce chunk cap synchronously (fast count + conditional delete)
  checkChunkCap()
}

/**
 * Hybrid retrieval: embed query → KNN + FTS5 → merge → rerank → top-K.
 *
 * Degrades gracefully:
 *   - No Ollama: skips vector search, uses FTS5 only
 *   - No vecAvailable: skips vector search
 *   - Reranker failure: returns cosine/BM25 order
 */
export async function retrieveRelevant(query: string, topK = 5): Promise<RetrievalResult> {
  const db = getDb()
  const start = Date.now()

  // Stage 1a: vector search (requires Ollama + sqlite-vec)
  const queryEmbedding = await embedText(query)
  const vecCandidates = fetchVectorCandidates(db, queryEmbedding, 20, vecAvailable)

  // Stage 1b: keyword search
  const ftsCandidates = fetchFtsCandidates(db, query, 20)

  // Merge and deduplicate (up to 12 for optimal reranking performance)
  const candidates = mergeCandidates(vecCandidates, ftsCandidates)

  let chunks: MemoryChunk[] = []

  if (candidates.length > 0) {
    // Stage 2: cross-encoder reranking
    // Ensure all content is valid strings (convert null/undefined to empty string)
    const texts = candidates.map((c) => String(c.content || ''))
    const scores = await rerankCandidates(query, texts)

    const ranked = candidates
      .map((c, i) => ({ ...c, rerankerScore: scores[i] ?? 0 }))
      .sort((a, b) => b.rerankerScore - a.rerankerScore)
      .slice(0, topK)

    incrementRetrievalCount(db, ranked.map((c) => c.id))

    chunks = ranked.map((c) => ({
      id: c.id,
      sourceType: c.sourceType,
      sourceId: c.sourceId,
      content: c.content,
      importanceScore: c.importanceScore,
      similarityScore: c.similarityScore,
      rerankerScore: c.rerankerScore,
      createdAt: c.createdAt
    }))
  }

  const durationMs = Date.now() - start
  console.log(`[Memory] Retrieved ${chunks.length} chunks in ${durationMs}ms`)

  // Log every retrieval to retrieval_logs (always, even when empty)
  try {
    const queryHash = createHash('sha256').update(query).digest('hex')
    db.prepare(
      `INSERT INTO retrieval_logs (query_hash, chunk_ids, similarity_scores, reranker_scores, duration_ms)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      queryHash,
      JSON.stringify(chunks.map(c => c.id)),
      JSON.stringify(chunks.map(c => c.similarityScore ?? 0)),
      JSON.stringify(chunks.map(c => c.rerankerScore ?? 0)),
      durationMs
    )
  } catch { /* non-critical — never block retrieval for logging failures */ }

  return { chunks, durationMs }
}

/**
 * On app launch: retry up to 50 chunks with embedding_status='pending'.
 * Stops early if Ollama is still unavailable.
 */
export async function retryPendingEmbeddings(): Promise<void> {
  const db = getDb()

  const pending = db
    .prepare(
      `SELECT id, content FROM memory_chunks
       WHERE embedding_status = 'pending'
       ORDER BY created_at ASC
       LIMIT 50`
    )
    .all() as PendingChunk[]

  if (pending.length === 0) return

  console.log(`[Memory] Retrying ${pending.length} pending embeddings...`)
  let succeeded = 0

  for (const chunk of pending) {
    const embedding = await embedText(chunk.content)

    if (!embedding) {
      console.log('[Memory] Ollama still unavailable — stopping retry batch')
      break // Don't hammer a down server
    }

    try {
      storeEmbedding(chunk.id, embedding)
      db.prepare(`UPDATE memory_chunks SET embedding_status = 'indexed' WHERE id = ?`).run(
        chunk.id
      )
      succeeded++
    } catch {
      db.prepare(`UPDATE memory_chunks SET embedding_status = 'failed' WHERE id = ?`).run(
        chunk.id
      )
    }
  }

  if (succeeded > 0) {
    console.log(`[Memory] Retried ${succeeded} embeddings successfully`)
  }
}

/**
 * Initialise the memory engine on app start.
 * Sets up the reranker worker and schedules retention tasks.
 */
export function initMemoryEngine(): void {
  // Pass userData path to reranker worker so model files stay on-device
  const cacheDir = app.getPath('userData')
  initReranker(cacheDir)

  // Pre-warm reranker to eliminate cold-start latency on first query
  setImmediate(() => {
    rerankCandidates('warmup query', ['warmup candidate']).catch(() => {
      // Warmup failure is non-critical - first real query will trigger model load
    })
  })

  // Run retention checks at startup
  purgeOldMessages()
  purgeOldSessions()

  // Schedule weekly sqlite-vec VACUUM
  scheduleWeeklyRebuild()

  console.log('[Memory] Engine initialised')
}

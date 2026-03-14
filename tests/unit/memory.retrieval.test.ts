import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../src/main/db/migrations'
import {
  fetchVectorCandidates,
  fetchFtsCandidates,
  mergeCandidates,
  incrementRetrievalCount
} from '../../src/main/memory/retrieval'

function openTestDb(): { db: Database.Database; vecAvailable: boolean } {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  let vecAvailable = false
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sqliteVec = require('sqlite-vec')
    sqliteVec.load(db)
    vecAvailable = true
  } catch {
    vecAvailable = false
  }

  runMigrations(db, vecAvailable)
  return { db, vecAvailable }
}

function insertChunk(
  db: Database.Database,
  content: string,
  importanceScore = 0.5
): number {
  const result = db
    .prepare(
      `INSERT INTO memory_chunks (source_type, source_id, content, importance_score)
       VALUES ('journal', 1, ?, ?)`
    )
    .run(content, importanceScore)

  // Use Number() to ensure plain JS number (better-sqlite3 can return bigint)
  const id = Number(result.lastInsertRowid)

  // Sync to FTS5
  db.prepare(`INSERT INTO memory_chunks_fts(rowid, content) VALUES (?, ?)`).run(id, content)

  return id
}

let db: Database.Database
let vecAvailable: boolean

beforeEach(() => {
  const result = openTestDb()
  db = result.db
  vecAvailable = result.vecAvailable
})

afterEach(() => {
  db.close()
})

describe('fetchFtsCandidates', () => {
  it('returns empty array when FTS table is empty', () => {
    const result = fetchFtsCandidates(db, 'anything', 20)
    expect(result).toEqual([])
  })

  it('returns matching chunks for a keyword query', () => {
    insertChunk(db, 'I feel anxious about the presentation tomorrow')
    insertChunk(db, 'Great coding session today, made a lot of progress')

    const result = fetchFtsCandidates(db, 'anxious', 20)
    expect(result.length).toBe(1)
    expect(result[0].content).toContain('anxious')
  })

  it('returns empty array for a query that matches nothing', () => {
    insertChunk(db, 'Some content about work')
    const result = fetchFtsCandidates(db, 'xyznonexistent', 20)
    expect(result).toEqual([])
  })

  it('respects the limit parameter', () => {
    for (let i = 0; i < 5; i++) {
      insertChunk(db, `progress entry number ${i}`)
    }
    const result = fetchFtsCandidates(db, 'progress', 3)
    expect(result.length).toBeLessThanOrEqual(3)
  })

  it('returns empty array for blank query', () => {
    insertChunk(db, 'Some content')
    const result = fetchFtsCandidates(db, '   ', 20)
    expect(result).toEqual([])
  })

  it('handles FTS5 special characters without throwing', () => {
    insertChunk(db, 'content with special chars')
    // Commas, operators, and punctuation must not cause FTS5 syntax errors
    expect(() => fetchFtsCandidates(db, 'hello, how are you?', 20)).not.toThrow()
    expect(() => fetchFtsCandidates(db, 'content * (test)', 20)).not.toThrow()
    expect(() => fetchFtsCandidates(db, 'foo: bar - baz', 20)).not.toThrow()
  })

  it('results have all required fields', () => {
    insertChunk(db, 'testing field structure')
    const result = fetchFtsCandidates(db, 'testing', 20)
    expect(result.length).toBeGreaterThan(0)
    const r = result[0]
    expect(typeof r.id).toBe('number')
    expect(typeof r.content).toBe('string')
    expect(typeof r.sourceType).toBe('string')
    expect(typeof r.sourceId).toBe('number')
    expect(typeof r.importanceScore).toBe('number')
    expect(typeof r.createdAt).toBe('string')
    expect(typeof r.similarityScore).toBe('number')
    expect(r.similarityScore).toBeGreaterThan(0)
  })
})

describe('fetchVectorCandidates', () => {
  it('returns empty array when vecAvailable is false', () => {
    const embedding = new Float32Array(768).fill(0.1)
    const result = fetchVectorCandidates(db, embedding, 20, false)
    expect(result).toEqual([])
  })

  it('returns empty array when queryEmbedding is null', () => {
    const result = fetchVectorCandidates(db, null, 20, true)
    expect(result).toEqual([])
  })

  it('returns results when vecAvailable is true and vectors are stored', () => {
    if (!vecAvailable) {
      console.log('Skipping — sqlite-vec not available in this environment')
      return
    }

    // Insert a chunk
    const chunkId = insertChunk(db, 'vector search test content')

    // Insert a corresponding vector
    const embedding = new Float32Array(768).fill(0.1)
    const buf = Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength)
    // sqlite-vec requires BigInt for vec0 rowid binding
    db.prepare(`INSERT INTO memory_vec(rowid, embedding) VALUES (?, ?)`).run(BigInt(chunkId), buf)

    const queryEmbedding = new Float32Array(768).fill(0.1)
    const result = fetchVectorCandidates(db, queryEmbedding, 20, true)

    expect(result.length).toBeGreaterThan(0)
    expect(result[0].content).toBe('vector search test content')
  })

  it('returns empty array when vector table is empty', () => {
    if (!vecAvailable) return

    insertChunk(db, 'no vector for this chunk')
    const embedding = new Float32Array(768).fill(0.1)
    const result = fetchVectorCandidates(db, embedding, 20, true)
    expect(result).toEqual([])
  })
})

describe('mergeCandidates', () => {
  it('deduplicates by id, vec candidates take precedence', () => {
    const vecResult = [
      { id: 1, content: 'vec', sourceType: 'journal' as const, sourceId: 1, importanceScore: 0.5, createdAt: '', similarityScore: 0.1 }
    ]
    const ftsResult = [
      { id: 1, content: 'fts', sourceType: 'journal' as const, sourceId: 1, importanceScore: 0.5, createdAt: '', similarityScore: 0.8 },
      { id: 2, content: 'only fts', sourceType: 'journal' as const, sourceId: 1, importanceScore: 0.5, createdAt: '', similarityScore: 0.7 }
    ]
    const merged = mergeCandidates(vecResult, ftsResult)
    expect(merged).toHaveLength(2)
    expect(merged.find((c) => c.id === 1)?.content).toBe('vec') // vec wins
  })

  it('returns up to maxCandidates unique results', () => {
    const vec = Array.from({ length: 20 }, (_, i) => ({
      id: i, content: `chunk ${i}`, sourceType: 'journal' as const, sourceId: 1,
      importanceScore: 0.5, createdAt: '', similarityScore: 0.1
    }))
    const fts = Array.from({ length: 20 }, (_, i) => ({
      id: i + 20, content: `fts ${i}`, sourceType: 'journal' as const, sourceId: 1,
      importanceScore: 0.5, createdAt: '', similarityScore: 0.5
    }))
    const merged = mergeCandidates(vec, fts, 30)
    expect(merged.length).toBe(30)
  })

  it('handles empty inputs', () => {
    expect(mergeCandidates([], [])).toEqual([])
    expect(mergeCandidates([{ id: 1, content: 'x', sourceType: 'journal', sourceId: 1, importanceScore: 0.5, createdAt: '', similarityScore: 0.1 }], [])).toHaveLength(1)
  })
})

describe('incrementRetrievalCount', () => {
  it('increments retrieval_count for given chunk ids', () => {
    const id1 = insertChunk(db, 'chunk one')
    const id2 = insertChunk(db, 'chunk two')

    incrementRetrievalCount(db, [id1, id2])

    const row1 = db.prepare('SELECT retrieval_count, importance_score FROM memory_chunks WHERE id = ?').get(id1) as { retrieval_count: number; importance_score: number }
    const row2 = db.prepare('SELECT retrieval_count FROM memory_chunks WHERE id = ?').get(id2) as { retrieval_count: number }

    expect(row1.retrieval_count).toBe(1)
    expect(row2.retrieval_count).toBe(1)
    expect(row1.importance_score).toBeCloseTo(0.51, 5)
  })

  it('caps importance_score at 1.0', () => {
    const id = insertChunk(db, 'high importance', 0.999)
    incrementRetrievalCount(db, [id])
    const row = db.prepare('SELECT importance_score FROM memory_chunks WHERE id = ?').get(id) as { importance_score: number }
    expect(row.importance_score).toBeLessThanOrEqual(1.0)
  })

  it('does nothing for empty array', () => {
    expect(() => incrementRetrievalCount(db, [])).not.toThrow()
  })
})

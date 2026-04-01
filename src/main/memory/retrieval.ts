/**
 * Hybrid retrieval: sqlite-vec KNN + FTS5 BM25.
 *
 * Stage 1a — Vector KNN (top-20 by cosine distance)
 * Stage 1b — FTS5 BM25 keyword search (top-20 by relevance)
 * Merge    — deduplicate by chunk id → up to 30 unique candidates
 *
 * All queries use better-sqlite3 (synchronous) — fast enough (<10ms each).
 * The CPU-bound reranking step is handled separately in reranker.ts.
 */

import type Database from 'better-sqlite3'

export interface RawCandidate {
  id: number
  content: string
  sourceType: 'journal' | 'conversation' | 'summary'
  sourceId: number
  importanceScore: number
  createdAt: string
  similarityScore: number // cosine distance (lower=better) or normalised BM25 proxy
}

/**
 * sqlite-vec KNN query — top-N chunks by cosine distance to the query embedding.
 * Returns [] when vecAvailable is false or embedding is null.
 */
export function fetchVectorCandidates(
  db: Database.Database,
  queryEmbedding: Float32Array | null,
  limit: number,
  vecAvailable: boolean
): RawCandidate[] {
  if (!vecAvailable || !queryEmbedding) return []

  try {
    // sqlite-vec requires the embedding as a raw binary buffer
    const buf = Buffer.from(
      queryEmbedding.buffer,
      queryEmbedding.byteOffset,
      queryEmbedding.byteLength
    )

    const rows = db
      .prepare(
        `SELECT mc.id, mc.content, mc.source_type, mc.source_id,
                mc.importance_score, mc.created_at,
                vec_distance_cosine(mv.embedding, ?) AS distance
         FROM memory_vec mv
         JOIN memory_chunks mc ON mc.id = mv.rowid
         ORDER BY distance ASC
         LIMIT ?`
      )
      .all(buf, limit) as Array<{
      id: number
      content: string
      source_type: string
      source_id: number
      importance_score: number
      created_at: string
      distance: number
    }>

    return rows.map((r) => ({
      id: r.id,
      content: r.content,
      sourceType: r.source_type as RawCandidate['sourceType'],
      sourceId: r.source_id,
      importanceScore: r.importance_score,
      createdAt: r.created_at,
      similarityScore: r.distance
    }))
  } catch (err) {
    console.warn('[Retrieval] Vector query failed:', (err as Error).message)
    return []
  }
}

/**
 * FTS5 BM25 keyword query — top-N chunks matching the query terms.
 * bm25() returns negative values; lower (more negative) = more relevant.
 * We normalise to a positive similarityScore: 1 / (1 + abs(bm25)).
 */
export function fetchFtsCandidates(
  db: Database.Database,
  query: string,
  limit: number
): RawCandidate[] {
  if (!query.trim()) return []

  try {
    // Strip all non-alphanumeric characters — FTS5 query is a plain word search
    const safeQuery = query.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
    if (!safeQuery) return []

    const rows = db
      .prepare(
        `SELECT mc.id, mc.content, mc.source_type, mc.source_id,
                mc.importance_score, mc.created_at,
                bm25(memory_chunks_fts) AS bm25_score
         FROM memory_chunks_fts
         JOIN memory_chunks mc ON mc.id = memory_chunks_fts.rowid
         WHERE memory_chunks_fts MATCH ?
         ORDER BY bm25_score ASC
         LIMIT ?`
      )
      .all(safeQuery, limit) as Array<{
      id: number
      content: string
      source_type: string
      source_id: number
      importance_score: number
      created_at: string
      bm25_score: number
    }>

    return rows.map((r) => ({
      id: r.id,
      content: r.content,
      sourceType: r.source_type as RawCandidate['sourceType'],
      sourceId: r.source_id,
      importanceScore: r.importance_score,
      createdAt: r.created_at,
      // Normalise BM25 (negative, lower=better) to 0–1 proxy (higher=better)
      similarityScore: 1 / (1 + Math.abs(r.bm25_score))
    }))
  } catch (err) {
    console.warn('[Retrieval] FTS5 query failed:', (err as Error).message)
    return []
  }
}

/**
 * Merge vector and FTS candidates, deduplicate by chunk id.
 * Vector candidates take precedence on duplicate ids (lower cosine distance).
 * Returns up to 12 unique candidates (optimized for reranker throughput).
 */
export function mergeCandidates(
  vecCandidates: RawCandidate[],
  ftsCandidates: RawCandidate[],
  maxCandidates = 12
): RawCandidate[] {
  const seen = new Map<number, RawCandidate>()

  for (const c of vecCandidates) {
    seen.set(c.id, c)
  }

  for (const c of ftsCandidates) {
    if (!seen.has(c.id)) {
      seen.set(c.id, c)
    }
  }

  return Array.from(seen.values()).slice(0, maxCandidates)
}

/**
 * Increment retrieval_count and update last_retrieved_at for the given chunk IDs.
 * Also applies a small importance boost (+0.01 per retrieval, capped at 1.0).
 */
export function incrementRetrievalCount(db: Database.Database, chunkIds: number[]): void {
  if (chunkIds.length === 0) return

  const update = db.prepare(
    `UPDATE memory_chunks
     SET retrieval_count    = retrieval_count + 1,
         last_retrieved_at  = datetime('now'),
         importance_score   = MIN(1.0, importance_score + 0.01)
     WHERE id = ?`
  )

  const updateMany = db.transaction((ids: number[]) => {
    for (const id of ids) {
      update.run(id)
    }
  })

  updateMany(chunkIds)
}

/**
 * Memory Engine — Phase 4
 *
 * Handles:
 *   - Chunking: paragraph splits, max 300 tokens, 30-token overlap
 *   - Embedding: nomic-embed-text via Ollama REST (768-dim float32)
 *   - Storage: memory_chunks table + memory_vec sqlite-vec virtual table
 *   - Retrieval: hybrid KNN (sqlite-vec) + FTS5 BM25 keyword search
 *   - Reranking: @xenova/transformers cross-encoder (ms-marco-MiniLM-L-6-v2 ONNX)
 *   - Retention: 2000-chunk hard cap with importance-based pruning
 *
 * All logic is stubbed until Phase 4.
 */

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

// Phase 4: ingest a journal entry or conversation turn into memory
export async function ingestEntry(_sourceType: string, _sourceId: number, _content: string): Promise<void> {
  console.log('[Memory] Ingest placeholder — Phase 4 implementation pending')
}

// Phase 4: hybrid retrieval — vector KNN + FTS5 + cross-encoder reranking
export async function retrieveRelevant(_query: string, _topK = 5): Promise<RetrievalResult> {
  console.log('[Memory] Retrieval placeholder — Phase 4 implementation pending')
  return { chunks: [], durationMs: 0 }
}

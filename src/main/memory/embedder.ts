/**
 * Ollama embedding client for memory ingestion and retrieval.
 *
 * Uses nomic-embed-text via Ollama REST API (127.0.0.1:11434).
 * Returns a 768-dimension Float32Array or null on any failure.
 *
 * Hard rules:
 *   - 5000ms AbortSignal timeout — no unbounded fetch
 *   - Validates embedding dimension === 768 before returning
 *   - Returns null on connection refused, timeout, HTTP error, wrong shape
 *   - Never throws — callers treat null as "Ollama unavailable"
 */

const OLLAMA_EMBED_URL = 'http://127.0.0.1:11434/api/embed'
const EMBED_MODEL = 'nomic-embed-text'
const EMBED_DIM = 768
const TIMEOUT_MS = 5000

interface OllamaEmbedResponse {
  embeddings: number[][]
}

/**
 * Embed a text string using nomic-embed-text via Ollama.
 *
 * @param text - Text to embed
 * @returns 768-dim Float32Array, or null if Ollama is unavailable
 */
export async function embedText(text: string): Promise<Float32Array | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(OLLAMA_EMBED_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBED_MODEL, input: text }),
      signal: controller.signal
    })

    if (!response.ok) {
      console.warn(`[Embedder] Ollama returned HTTP ${response.status}`)
      return null
    }

    const data = (await response.json()) as OllamaEmbedResponse
    const embedding = data.embeddings?.[0]

    if (!Array.isArray(embedding) || embedding.length !== EMBED_DIM) {
      console.warn(
        `[Embedder] Unexpected embedding shape: ${embedding?.length ?? 'missing'}`
      )
      return null
    }

    return new Float32Array(embedding)
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn('[Embedder] Request timed out after 5000ms')
    } else {
      console.warn('[Embedder] Ollama unreachable:', (err as Error).message)
    }
    return null
  } finally {
    clearTimeout(timer)
  }
}

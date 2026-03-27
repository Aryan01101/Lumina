/**
 * Reranker worker thread.
 *
 * Runs @xenova/transformers ONNX cross-encoder (Xenova/ms-marco-MiniLM-L-6-v2) in a
 * dedicated worker thread so CPU-bound inference never blocks the main process.
 *
 * Protocol:
 *   workerData: { cacheDir: string }
 *   Incoming message: { id: number, query: string, candidates: string[] }
 *   Outgoing message: { id: number, scores: number[] }
 *   Outgoing message on ready: { ready: true }
 *   Outgoing message on error: { id: number, error: string }
 */

import { parentPort, workerData } from 'worker_threads'

const RERANKER_MODEL = 'Xenova/ms-marco-MiniLM-L-6-v2'

interface IncomingMessage {
  id: number
  query: string
  candidates: string[]
}

async function main(): Promise<void> {
  if (!parentPort) return

  // Set cache directory to app userData so model files stay on-device
  const { env, pipeline } = await import('@xenova/transformers')
  if (workerData?.cacheDir) {
    env.cacheDir = workerData.cacheDir
  }

  // Lazy-load the pipeline on first use — model is downloaded once (~80MB)
  let reranker: Awaited<ReturnType<typeof pipeline>> | null = null

  const getReranker = async (): Promise<Awaited<ReturnType<typeof pipeline>>> => {
    if (!reranker) {
      console.log('[Reranker] Loading ONNX cross-encoder model...')
      reranker = await pipeline('text-classification', RERANKER_MODEL, {
        quantized: true
      })
      console.log('[Reranker] Model loaded')
    }
    return reranker
  }

  parentPort.postMessage({ ready: true })

  parentPort.on('message', async (msg: IncomingMessage) => {
    if (!parentPort) return

    try {
      const model = await getReranker()

      // Validate and sanitize inputs
      const query = String(msg.query || '')
      const candidates = (msg.candidates || []).map((c) => String(c || ''))

      if (!query.trim() || candidates.length === 0) {
        parentPort.postMessage({
          id: msg.id,
          scores: candidates.map(() => 0)
        })
        return
      }

      // Score each [query, candidate] pair
      // text-classification pipeline expects arrays, not objects
      const pairs = candidates.map((candidate) => [query, candidate])
      const results = await model(pairs, { topk: null })

      // Extract the relevance score from each result
      // ms-marco returns label 'LABEL_0' (irrelevant, low score) or 'LABEL_1' (relevant, high)
      const scores: number[] = Array.isArray(results)
        ? results.map((r: { label: string; score: number }) =>
            r.label === 'LABEL_1' ? r.score : 1 - r.score
          )
        : candidates.map(() => 0)

      parentPort.postMessage({ id: msg.id, scores })
    } catch (err) {
      console.error('[Reranker] Scoring failed:', err)
      const fallbackCandidates = (msg.candidates || []).map(() => 0)
      parentPort.postMessage({
        id: msg.id,
        error: (err as Error).message,
        scores: fallbackCandidates
      })
    }
  })
}

main().catch((err) => {
  console.error('[Reranker] Worker failed to start:', err)
  process.exit(1)
})

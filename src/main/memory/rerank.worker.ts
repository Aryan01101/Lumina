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
      const candidates = (msg.candidates || [])
        .map((c) => String(c || ''))
        .filter((c) => c.trim().length > 0) // Filter out empty strings

      if (!query.trim() || candidates.length === 0) {
        console.log('[Reranker] Skipping - empty query or no candidates')
        parentPort.postMessage({
          id: msg.id,
          scores: (msg.candidates || []).map(() => 0)
        })
        return
      }

      // Additional validation: ensure all candidates are strings
      const invalidCandidate = candidates.find((c) => typeof c !== 'string')
      if (invalidCandidate !== undefined) {
        console.error('[Reranker] Invalid candidate detected:', typeof invalidCandidate, invalidCandidate)
        throw new Error(`Invalid candidate type: ${typeof invalidCandidate}`)
      }

      // Score each [query, candidate] pair sequentially
      // Process one at a time - transformers.js batch processing doesn't work reliably for sentence pairs
      const results: Array<{ label: string; score: number }> = []
      for (let i = 0; i < candidates.length; i++) {
        // Cast to any to bypass complex union types - @xenova/transformers has imperfect typing
        const result = await (model as any)(query, { text_pair: candidates[i] })
        // Result can be a single object or array depending on API version
        const output = Array.isArray(result) ? result[0] : result
        results.push(output)
      }

      // Extract the relevance score from each result
      // ms-marco returns label 'LABEL_0' (irrelevant, low score) or 'LABEL_1' (relevant, high)
      const scores: number[] = results.map((r) =>
        r.label === 'LABEL_1' ? r.score : 1 - r.score
      )

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

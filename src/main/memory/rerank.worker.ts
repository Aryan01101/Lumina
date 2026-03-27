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

      console.log('[Reranker] Debug - query type:', typeof query, 'length:', query.length)
      console.log('[Reranker] Debug - candidates count:', candidates.length)
      console.log('[Reranker] Debug - first candidate type:', typeof candidates[0], 'value:', candidates[0]?.slice(0, 50))

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

      // Score each [query, candidate] pair
      // transformers.js text-classification requires object format for sentence pairs
      const inputs = candidates.map((candidate) => ({
        text: query,
        text_pair: candidate
      }))
      console.log('[Reranker] Debug - inputs count:', inputs.length, 'first input format:', JSON.stringify(inputs[0], null, 2).slice(0, 150))

      let results
      try {
        results = await model(inputs)
      } catch (modelErr) {
        console.error('[Reranker] Model call failed. Trying sequential processing...')
        console.error('[Reranker] Batch error:', modelErr)

        // Fallback: process one pair at a time
        try {
          results = []
          for (let i = 0; i < candidates.length; i++) {
            const result = await model({ text: query, text_pair: candidates[i] })
            results.push(result[0]) // Take first result from single-item array
            console.log(`[Reranker] Processed ${i + 1}/${candidates.length}`)
          }
        } catch (seqErr) {
          console.error('[Reranker] Sequential processing also failed:', seqErr)
          throw seqErr
        }
      }

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

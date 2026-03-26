/**
 * Reranker wrapper — manages the singleton rerank.worker.js thread.
 *
 * Lazily spawns the worker on first call. Falls back to flat zero scores
 * (preserving cosine similarity order) if the worker fails to start or crashes.
 *
 * The worker path is resolved relative to __dirname at runtime, which points
 * to out/main/ in both dev and production builds.
 */

import { Worker } from 'worker_threads'
import { join } from 'path'

let worker: Worker | null = null
let workerReady = false
let pendingRequests = new Map<number, (scores: number[]) => void>()
let requestCounter = 0
let cacheDir = ''

interface WorkerMessage {
  id?: number
  scores?: number[]
  error?: string
  ready?: boolean
}

function spawnWorker(): void {
  const workerPath = join(__dirname, 'rerank.worker.js')

  try {
    worker = new Worker(workerPath, { workerData: { cacheDir } })
  } catch (err) {
    console.error('[Reranker] Failed to spawn worker:', err)
    worker = null
    return
  }

  worker.on('message', (msg: WorkerMessage) => {
    if (msg.ready) {
      workerReady = true
      console.log('[Reranker] Worker ready')
      return
    }

    if (msg.id !== undefined && pendingRequests.has(msg.id)) {
      const resolve = pendingRequests.get(msg.id)!
      pendingRequests.delete(msg.id)
      resolve(msg.scores ?? [])
    }
  })

  worker.on('error', (err) => {
    console.error('[Reranker] Worker error:', err)
    // Resolve all pending requests with empty scores so callers are not blocked
    for (const [, resolve] of pendingRequests) {
      resolve([])
    }
    pendingRequests.clear()
    worker = null
    workerReady = false
  })

  worker.on('exit', (code) => {
    if (code !== 0) {
      console.warn(`[Reranker] Worker exited with code ${code}`)
    }
    worker = null
    workerReady = false
  })
}

/** Must be called before first use to set the model cache directory. */
export function initReranker(appCacheDir: string): void {
  cacheDir = appCacheDir
}

/**
 * Score candidate passages against a query using the cross-encoder.
 *
 * Gracefully degrades to similarity-only ranking if the reranker worker fails,
 * times out, or cannot load the model. This ensures retrieval always completes.
 *
 * @param query - The retrieval query
 * @param candidates - Array of candidate text strings to score
 * @returns Array of relevance scores parallel to candidates.
 *          Returns zeros (preserving similarity order) if reranker unavailable.
 */
export async function rerankCandidates(
  query: string,
  candidates: string[]
): Promise<number[]> {
  if (candidates.length === 0) return []

  // Validate inputs - ensure query and all candidates are valid strings
  const validQuery = String(query || '')
  const validCandidates = candidates.map((c) => String(c || ''))

  if (!validQuery.trim()) {
    console.warn('[Reranker] Empty query, returning zero scores')
    return validCandidates.map(() => 0)
  }

  // Lazily spawn worker on first call
  if (!worker) {
    spawnWorker()
  }

  if (!worker) {
    // Worker failed to spawn — return flat scores (preserves cosine order)
    console.warn(
      '[Reranker] Worker failed to spawn, using similarity-only ranking (no reranking)'
    )
    return candidates.map(() => 0)
  }

  const id = ++requestCounter

  return new Promise<number[]>((resolve) => {
    // Timeout safety: if worker hangs for >10s, resolve with zeros
    const timeout = setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id)
        console.warn(
          '[Reranker] Request timed out after 10s, falling back to similarity-only ranking'
        )
        resolve(candidates.map(() => 0))
      }
    }, 10_000)

    pendingRequests.set(id, (scores) => {
      clearTimeout(timeout)
      resolve(scores)
    })

    worker!.postMessage({ id, query: validQuery, candidates: validCandidates })
  })
}

/** Gracefully shut down the worker thread. Call on app quit. */
export async function terminateReranker(): Promise<void> {
  if (worker) {
    await worker.terminate()
    worker = null
    workerReady = false
    pendingRequests.clear()
  }
}

export { workerReady }

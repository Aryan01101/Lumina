/**
 * Ollama HTTP Client — Phase 6
 *
 * Thin wrapper around Ollama's /api/generate endpoint.
 * streamGenerate: streaming with token callbacks, 30s timeout, AbortController.
 * generate: one-shot non-streaming call, returns null on any failure.
 * pingOllama: health check, 3s timeout.
 */

const OLLAMA_BASE        = 'http://127.0.0.1:11434'
const STREAM_TIMEOUT_MS  = 30_000
const GENERATE_TIMEOUT_MS = 45_000
const PING_TIMEOUT_MS    = 3_000

export interface GenerateOptions {
  model:       string
  system:      string
  prompt:      string
  stream:      boolean
  num_predict?: number
}

export interface GenerateResult {
  fullText:         string
  promptTokens:     number
  completionTokens: number
  durationMs:       number
}

/**
 * Streams tokens from Ollama, calling onToken for each non-empty chunk.
 * Calls onDone with aggregated stats when the stream ends.
 * Calls onError with a human-readable message on any failure.
 * Aborts automatically after STREAM_TIMEOUT_MS.
 */
export async function streamGenerate(
  opts: GenerateOptions,
  onToken: (token: string) => void,
  onDone:  (result: GenerateResult) => void,
  onError: (message: string) => void
): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS)

  try {
    const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...opts, stream: true }),
      signal: controller.signal
    })

    if (!response.ok) {
      onError(`Ollama returned HTTP ${response.status} error`)
      return
    }

    if (!response.body) {
      onError('Ollama response has no body')
      return
    }

    const reader  = response.body.getReader()
    const decoder = new TextDecoder()
    let remainder = ''
    let fullText  = ''
    let promptTokens     = 0
    let completionTokens = 0
    let totalDurationNs  = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      remainder += decoder.decode(value, { stream: true })
      const lines = remainder.split('\n')
      remainder = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const chunk = JSON.parse(trimmed) as {
            response: string
            done: boolean
            total_duration?: number
            prompt_eval_count?: number
            eval_count?: number
          }
          if (chunk.response) {
            fullText += chunk.response
            onToken(chunk.response)
          }
          if (chunk.done) {
            promptTokens     = chunk.prompt_eval_count ?? 0
            completionTokens = chunk.eval_count ?? 0
            totalDurationNs  = chunk.total_duration ?? 0
          }
        } catch {
          // malformed JSON line — skip
        }
      }
    }

    onDone({
      fullText,
      promptTokens,
      completionTokens,
      durationMs: Math.round(totalDurationNs / 1_000_000)
    })
  } catch (err: unknown) {
    const error = err as Error
    if (error.name === 'AbortError') {
      onError('Ollama request timed out or was aborted')
    } else {
      onError(error.message ?? 'Ollama unavailable')
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * One-shot non-streaming generate. Returns null on any error.
 * Aborts automatically after GENERATE_TIMEOUT_MS.
 */
export async function generate(opts: GenerateOptions): Promise<GenerateResult | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS)
  try {
    const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...opts, stream: false }),
      signal: controller.signal
    })

    if (!response.ok) return null

    const data = await response.json() as {
      response: string
      total_duration?: number
      prompt_eval_count?: number
      eval_count?: number
    }

    return {
      fullText:         data.response ?? '',
      promptTokens:     data.prompt_eval_count ?? 0,
      completionTokens: data.eval_count ?? 0,
      durationMs:       Math.round((data.total_duration ?? 0) / 1_000_000)
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Health check. Returns true if Ollama is reachable.
 * Uses GET /api/tags (no model required — works before any model is pulled).
 */
export async function pingOllama(): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS)
  try {
    const response = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: controller.signal })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

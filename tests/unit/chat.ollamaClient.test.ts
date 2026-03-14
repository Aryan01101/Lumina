import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { streamGenerate, generate, pingOllama } from '../../src/main/chat/ollamaClient'
import type { GenerateOptions, GenerateResult } from '../../src/main/chat/ollamaClient'

// ─── Fetch mock helpers ───────────────────────────────────────────────────────

function makeStreamResponse(lines: string[]) {
  const encoder = new TextEncoder()
  const body = new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line + '\n'))
      }
      controller.close()
    }
  })
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    body,
    json: async () => ({})
  })
}

function makeJsonResponse(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    body: null,
    json: async () => body
  })
}

const baseOptions: GenerateOptions = {
  model: 'llama3.1:8b',
  system: 'You are Lumina.',
  prompt: 'Hello',
  stream: true
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

// ─── streamGenerate ───────────────────────────────────────────────────────────

describe('streamGenerate', () => {
  it('calls onToken for each non-empty token in the stream', async () => {
    const lines = [
      JSON.stringify({ response: 'Hello', done: false }),
      JSON.stringify({ response: ' world', done: false }),
      JSON.stringify({ response: '', done: true, total_duration: 1_000_000_000, prompt_eval_count: 10, eval_count: 5 })
    ]
    vi.stubGlobal('fetch', makeStreamResponse(lines))

    const tokens: string[] = []
    let doneResult: GenerateResult | null = null

    await streamGenerate(
      baseOptions,
      (t) => tokens.push(t),
      (r) => { doneResult = r },
      () => {}
    )

    expect(tokens).toEqual(['Hello', ' world'])
    expect(doneResult).not.toBeNull()
    expect(doneResult!.fullText).toBe('Hello world')
  })

  it('calls onDone with correct token counts and durationMs from Ollama stats', async () => {
    const lines = [
      JSON.stringify({ response: 'Hi', done: false }),
      JSON.stringify({ response: '', done: true, total_duration: 2_000_000_000, prompt_eval_count: 20, eval_count: 3 })
    ]
    vi.stubGlobal('fetch', makeStreamResponse(lines))

    let result: GenerateResult | null = null
    await streamGenerate(baseOptions, () => {}, (r) => { result = r }, () => {})

    expect(result!.promptTokens).toBe(20)
    expect(result!.completionTokens).toBe(3)
    expect(result!.durationMs).toBe(2000)
  })

  it('calls onError and does NOT call onDone when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    let errorMsg = ''
    let doneCalled = false
    await streamGenerate(baseOptions, () => {}, () => { doneCalled = true }, (e) => { errorMsg = e })

    expect(doneCalled).toBe(false)
    expect(errorMsg).toMatch(/ECONNREFUSED|unavailable/i)
  })

  it('calls onError when Ollama returns HTTP 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, body: null }))

    let errorMsg = ''
    await streamGenerate(baseOptions, () => {}, () => {}, (e) => { errorMsg = e })
    expect(errorMsg).toMatch(/500|error/i)
  })

  it('calls onError on AbortError (timeout)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, options: RequestInit) =>
        new Promise<never>((_resolve, reject) => {
          options.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted')
            err.name = 'AbortError'
            reject(err)
          })
        })
      )
    )

    let errorMsg = ''
    const p = streamGenerate(baseOptions, () => {}, () => {}, (e) => { errorMsg = e })
    vi.advanceTimersByTime(30_001)
    await p

    expect(errorMsg).toMatch(/timeout|aborted/i)
  })
})

// ─── generate ────────────────────────────────────────────────────────────────

describe('generate', () => {
  it('returns GenerateResult on a valid non-streaming response', async () => {
    vi.stubGlobal('fetch', makeJsonResponse({
      response: '0.9',
      done: true,
      total_duration: 500_000_000,
      prompt_eval_count: 15,
      eval_count: 2
    }))

    const result = await generate({ ...baseOptions, stream: false })
    expect(result).not.toBeNull()
    expect(result!.fullText).toBe('0.9')
    expect(result!.promptTokens).toBe(15)
    expect(result!.completionTokens).toBe(2)
    expect(result!.durationMs).toBe(500)
  })

  it('returns null when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    expect(await generate({ ...baseOptions, stream: false })).toBeNull()
  })

  it('returns null when Ollama returns HTTP 503', async () => {
    vi.stubGlobal('fetch', makeJsonResponse({}, false))
    expect(await generate({ ...baseOptions, stream: false })).toBeNull()
  })
})

// ─── pingOllama ───────────────────────────────────────────────────────────────

describe('pingOllama', () => {
  it('returns true when Ollama responds with ok', async () => {
    vi.stubGlobal('fetch', makeJsonResponse({ response: 'ok', done: true }))
    expect(await pingOllama()).toBe(true)
  })

  it('returns false when fetch throws (Ollama not running)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    expect(await pingOllama()).toBe(false)
  })
})

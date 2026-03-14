import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { embedText } from '../../src/main/memory/embedder'

function makeFetchMock(response: {
  ok: boolean
  status?: number
  body?: unknown
}) {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? 200,
    json: async () => response.body
  })
}

describe('embedText', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('returns Float32Array of length 768 on valid Ollama response', async () => {
    const embedding = Array.from({ length: 768 }, () => Math.random())
    vi.stubGlobal('fetch', makeFetchMock({ ok: true, body: { embeddings: [embedding] } }))

    const result = await embedText('hello world')
    expect(result).toBeInstanceOf(Float32Array)
    expect(result!.length).toBe(768)
    expect(result![0]).toBeCloseTo(embedding[0], 5)
  })

  it('returns null when fetch throws (connection refused)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    const result = await embedText('test')
    expect(result).toBeNull()
  })

  it('returns null when Ollama returns HTTP 500', async () => {
    vi.stubGlobal('fetch', makeFetchMock({ ok: false, status: 500, body: {} }))

    const result = await embedText('test')
    expect(result).toBeNull()
  })

  it('returns null when Ollama returns HTTP 404', async () => {
    vi.stubGlobal('fetch', makeFetchMock({ ok: false, status: 404, body: {} }))

    const result = await embedText('test')
    expect(result).toBeNull()
  })

  it('returns null when embedding dimension is wrong', async () => {
    const embedding = Array.from({ length: 512 }, () => 0.1) // wrong dim
    vi.stubGlobal('fetch', makeFetchMock({ ok: true, body: { embeddings: [embedding] } }))

    const result = await embedText('test')
    expect(result).toBeNull()
  })

  it('returns null when embeddings field is missing', async () => {
    vi.stubGlobal('fetch', makeFetchMock({ ok: true, body: {} }))

    const result = await embedText('test')
    expect(result).toBeNull()
  })

  it('returns null when embeddings array is empty', async () => {
    vi.stubGlobal('fetch', makeFetchMock({ ok: true, body: { embeddings: [] } }))

    const result = await embedText('test')
    expect(result).toBeNull()
  })

  it('returns null on AbortError (timeout)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        (_url: string, options: RequestInit) =>
          new Promise<never>((_resolve, reject) => {
            options.signal?.addEventListener('abort', () => {
              const err = new Error('The operation was aborted')
              err.name = 'AbortError'
              reject(err)
            })
          })
      )
    )

    const resultPromise = embedText('test')
    vi.advanceTimersByTime(5001)
    const result = await resultPromise
    expect(result).toBeNull()
  })
})

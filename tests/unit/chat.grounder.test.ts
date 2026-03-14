import { describe, it, expect, vi, afterEach } from 'vitest'
import { scoreGroundedness } from '../../src/main/chat/grounder'

function makeFetchResponse(responseText: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    body: null,
    json: async () => ({
      response: responseText,
      done: true,
      total_duration: 100_000_000,
      prompt_eval_count: 5,
      eval_count: 2
    })
  })
}

afterEach(() => { vi.restoreAllMocks() })

describe('scoreGroundedness', () => {
  it('extracts a decimal score like "0.87" from the LLM response', async () => {
    vi.stubGlobal('fetch', makeFetchResponse('0.87'))
    const score = await scoreGroundedness('question', 'answer', ['chunk 1'])
    expect(score).toBeCloseTo(0.87, 5)
  })

  it('extracts score when surrounded by whitespace and newlines', async () => {
    vi.stubGlobal('fetch', makeFetchResponse('  \n0.92\n  '))
    expect(await scoreGroundedness('q', 'a', ['chunk'])).toBeCloseTo(0.92, 5)
  })

  it('extracts "1.0" as score 1.0', async () => {
    vi.stubGlobal('fetch', makeFetchResponse('1.0'))
    expect(await scoreGroundedness('q', 'a', ['chunk'])).toBeCloseTo(1.0, 5)
  })

  it('returns null when response contains no extractable number', async () => {
    vi.stubGlobal('fetch', makeFetchResponse('I cannot determine a score from this'))
    expect(await scoreGroundedness('q', 'a', ['chunk'])).toBeNull()
  })

  it('returns null immediately without calling fetch when chunks array is empty', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await scoreGroundedness('q', 'a', [])).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null when Ollama is unavailable (fetch rejects)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    expect(await scoreGroundedness('q', 'a', ['chunk'])).toBeNull()
  })
})

/**
 * Observability — Langfuse Tests — Phase 9
 *
 * Tests the Langfuse wrapper: init guard, enabled check, trace helpers, error resilience.
 * The langfuse npm module is fully mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock langfuse SDK ────────────────────────────────────────────────────────
// vi.mock() is hoisted before const declarations, causing TDZ errors if mock
// variables are defined as const at module scope. vi.hoisted() runs before the
// hoist, making these variables available when the factory executes.
const {
  MockLangfuse,
  mockTrace,
  mockSpan,
  mockGeneration,
  mockShutdown,
  mockFlushAsync
} = vi.hoisted(() => {
  const mockTrace      = vi.fn().mockReturnValue({ span: vi.fn(), generation: vi.fn() })
  const mockSpan       = vi.fn()
  const mockGeneration = vi.fn()
  const mockShutdown   = vi.fn().mockResolvedValue(undefined)
  const mockFlushAsync = vi.fn().mockResolvedValue(undefined)

  const MockLangfuse = vi.fn().mockImplementation(() => ({
    trace:      mockTrace,
    span:       mockSpan,
    generation: mockGeneration,
    shutdown:   mockShutdown,
    flushAsync: mockFlushAsync
  }))

  return { MockLangfuse, mockTrace, mockSpan, mockGeneration, mockShutdown, mockFlushAsync }
})

vi.mock('langfuse', () => ({
  Langfuse: MockLangfuse
}))

// ─── Mock settings ────────────────────────────────────────────────────────────
const mockGetSetting = vi.fn()

vi.mock('../../src/main/settings', () => ({
  getSetting:    (...args: unknown[]) => mockGetSetting(...args),
  getSettings:   vi.fn(),
  setSetting:    vi.fn(),
  resetSettings: vi.fn()
}))

import {
  initLangfuse,
  isEnabled,
  resetLangfuse,
  traceAgentRun,
  traceRetrieval,
  traceLlmCall
} from '../../src/main/observability/langfuse'

import type { AgentState } from '../../src/main/agent/index'

beforeEach(() => {
  vi.clearAllMocks()
  resetLangfuse()
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAgentState(overrides: Partial<AgentState> = {}): AgentState {
  return {
    trigger:               'scheduled',
    activityState:         'IDLE',
    isTransition:          false,
    transitionContext:     '',
    timeOfDay:             new Date().toISOString(),
    lastInitiationAt:      null,
    consecutiveDismissals: 0,
    pausedUntil:           null,
    lastJournalAt:         null,
    lastConversationAt:    null,
    moodTrend7d:           null,
    moodTrendDirection:    null,
    gateResults:           {},
    retrievedMemories:     [],
    analysis:              '',
    actionType:            'CHECKIN',
    message:               'How are you doing?',
    runId:                 'test-run-001',
    ...overrides
  }
}

// ─── Init + Enabled Guard ─────────────────────────────────────────────────────

describe('isEnabled / initLangfuse', () => {
  it('isEnabled() returns false when observability=off', () => {
    mockGetSetting.mockReturnValue('off')
    initLangfuse()
    expect(isEnabled()).toBe(false)
  })

  it('isEnabled() returns false when observability=local', () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'observability') return 'local'
      if (key === 'langfuseKey') return ''
      return undefined
    })
    initLangfuse()
    expect(isEnabled()).toBe(false)
    expect(MockLangfuse).not.toHaveBeenCalled()
  })

  it('isEnabled() returns true when observability=langfuse and key is set', () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'observability') return 'langfuse'
      if (key === 'langfuseKey') return 'pk-test-abc123'
      return undefined
    })
    initLangfuse()
    expect(isEnabled()).toBe(true)
    expect(MockLangfuse).toHaveBeenCalledWith(expect.objectContaining({
      publicKey: 'pk-test-abc123'
    }))
  })
})

// ─── Trace Helpers ────────────────────────────────────────────────────────────

describe('trace helpers — when enabled', () => {
  beforeEach(() => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'observability') return 'langfuse'
      if (key === 'langfuseKey') return 'pk-test-abc123'
      return undefined
    })
    initLangfuse()
  })

  it('traceAgentRun() calls langfuse.trace() with correct name and metadata', () => {
    const state = makeAgentState({ actionType: 'CHECKIN', runId: 'run-42' })
    traceAgentRun(state)

    expect(mockTrace).toHaveBeenCalledWith(expect.objectContaining({
      name:     'agent-run',
      metadata: expect.objectContaining({ runId: 'run-42', actionType: 'CHECKIN' })
    }))
  })

  it('traceRetrieval() calls langfuse.span() when enabled', () => {
    traceRetrieval('how are you', [1, 2, 3], 85)

    expect(mockSpan).toHaveBeenCalledWith(expect.objectContaining({
      name: 'retrieval'
    }))
  })

  it('traceLlmCall() calls langfuse.generation() when enabled', () => {
    traceLlmCall('chat', 'llama3.1:8b', 100, 50, 350)

    expect(mockGeneration).toHaveBeenCalledWith(expect.objectContaining({
      name:  'llm-call',
      model: 'llama3.1:8b'
    }))
  })

  it('all helpers are no-ops when disabled', () => {
    resetLangfuse() // disables the client
    const state = makeAgentState()

    traceAgentRun(state)
    traceRetrieval('query', [1], 50)
    traceLlmCall('chat', 'llama3.1:8b', 10, 5, 100)

    expect(mockTrace).not.toHaveBeenCalled()
    expect(mockSpan).not.toHaveBeenCalled()
    expect(mockGeneration).not.toHaveBeenCalled()
  })
})

// ─── Error Resilience ─────────────────────────────────────────────────────────

describe('error resilience', () => {
  it('Langfuse SDK throws on init → isEnabled() returns false, no crash', () => {
    MockLangfuse.mockImplementationOnce(() => { throw new Error('Network error') })
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'observability') return 'langfuse'
      if (key === 'langfuseKey') return 'pk-bad-key'
      return undefined
    })

    expect(() => initLangfuse()).not.toThrow()
    expect(isEnabled()).toBe(false)
  })

  it('traceAgentRun() throws internally → error caught silently, no crash', () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'observability') return 'langfuse'
      if (key === 'langfuseKey') return 'pk-test-abc123'
      return undefined
    })
    initLangfuse()
    mockTrace.mockImplementationOnce(() => { throw new Error('trace failed') })

    expect(() => traceAgentRun(makeAgentState())).not.toThrow()
  })

  it('traceLlmCall() throws → does not propagate (fire-and-forget)', () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'observability') return 'langfuse'
      if (key === 'langfuseKey') return 'pk-test-abc123'
      return undefined
    })
    initLangfuse()
    mockGeneration.mockImplementationOnce(() => { throw new Error('generation failed') })

    expect(() => traceLlmCall('chat', 'llama3.1:8b', 10, 5, 100)).not.toThrow()
  })
})

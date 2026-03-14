/**
 * Agent Graph Tests — Phase 7
 *
 * Tests the 6-node StateGraph with mocked Ollama + memory deps.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../src/main/db/migrations'

// ─── Mock db singleton ────────────────────────────────────────────────────────
vi.mock('../../src/main/db', () => {
  let _db: Database.Database | null = null
  return {
    getDb: () => {
      if (!_db) throw new Error('Test DB not initialised')
      return _db
    },
    vecAvailable: false,
    __setTestDb: (db: Database.Database) => { _db = db }
  }
})

// ─── Mock Ollama generate ─────────────────────────────────────────────────────
vi.mock('../../src/main/chat/ollamaClient', () => ({
  generate:     vi.fn().mockResolvedValue({ fullText: 'CHECKIN', promptTokens: 10, completionTokens: 2, durationMs: 100 }),
  streamGenerate: vi.fn(),
  pingOllama:   vi.fn().mockResolvedValue(true)
}))

// ─── Mock memory retrieval ────────────────────────────────────────────────────
vi.mock('../../src/main/memory', () => ({
  retrieveRelevant: vi.fn().mockResolvedValue({ chunks: [], durationMs: 0 }),
  ingestEntry: vi.fn(),
  retryPendingEmbeddings: vi.fn(),
  initMemoryEngine: vi.fn()
}))

// ─── Mock embedder ────────────────────────────────────────────────────────────
vi.mock('../../src/main/memory/embedder', () => ({
  embedText: vi.fn().mockResolvedValue(null)
}))

// ─── Mock reranker ────────────────────────────────────────────────────────────
vi.mock('../../src/main/memory/reranker', () => ({
  initReranker:      vi.fn(),
  rerankCandidates:  vi.fn().mockResolvedValue([]),
  isRerankerReady:   vi.fn().mockReturnValue(false),
  terminateReranker: vi.fn().mockResolvedValue(undefined)
}))

// ─── Mock node-cron ───────────────────────────────────────────────────────────
vi.mock('node-cron', () => ({
  default: { schedule: vi.fn() },
  schedule: vi.fn()
}))

// ─── Mock activity ────────────────────────────────────────────────────────────
vi.mock('../../src/main/activity', () => ({
  getCurrentActivity: vi.fn().mockReturnValue({
    state: 'IDLE',
    appName: 'Finder',
    startedAt: new Date()
  }),
  startActivityMonitor: vi.fn(),
  stopActivityMonitor:  vi.fn()
}))

// ─── Mock CCM ────────────────────────────────────────────────────────────────
vi.mock('../../src/main/ccm', () => ({
  getCCMSummary: vi.fn().mockReturnValue('')
}))

import { runAgentGraph } from '../../src/main/agent/graph'
import type { AgentState } from '../../src/main/agent/index'
import { generate } from '../../src/main/chat/ollamaClient'
import { retrieveRelevant } from '../../src/main/memory'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { __setTestDb } = await import('../../src/main/db') as any

// ─── Helpers ──────────────────────────────────────────────────────────────────

function openTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db, false)
  return db
}

interface FakeWindow {
  webContents: { send: ReturnType<typeof vi.fn> }
  isDestroyed: () => boolean
}

function makeFakeWindow(): FakeWindow {
  return {
    webContents: { send: vi.fn() },
    isDestroyed: () => false
  }
}

function makeDaytimeState(overrides: Partial<AgentState> = {}): AgentState {
  const now = new Date()
  now.setHours(10, 0, 0, 0)
  return {
    trigger:               'scheduled',
    activityState:         'IDLE',
    isTransition:          false,
    transitionContext:     '',
    timeOfDay:             now.toISOString(),
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
    actionType:            'SILENCE',
    message:               null,
    runId:                 'test-run-id',
    ...overrides
  }
}

let db: Database.Database

beforeEach(() => {
  db = openTestDb()
  __setTestDb(db)
  vi.clearAllMocks()
  // Default: generate returns CHECKIN for decide, then a message for act
  vi.mocked(generate).mockResolvedValue({
    fullText: 'CHECKIN', promptTokens: 10, completionTokens: 2, durationMs: 100
  })
})

afterEach(() => {
  db.close()
})

// ─── Gate check short-circuits ────────────────────────────────────────────────

describe('gate check short-circuit', () => {
  it('DEEP_WORK → actionType=SILENCE, message=null, Ollama not called', async () => {
    const nightState = makeDaytimeState({ activityState: 'DEEP_WORK' })
    const result = await runAgentGraph(nightState, makeFakeWindow() as never, db)

    expect(result.actionType).toBe('SILENCE')
    expect(result.message).toBeNull()
    expect(generate).not.toHaveBeenCalled()
  })

  it('GAMING → actionType=SILENCE, no Ollama calls', async () => {
    const result = await runAgentGraph(
      makeDaytimeState({ activityState: 'GAMING' }),
      makeFakeWindow() as never,
      db
    )
    expect(result.actionType).toBe('SILENCE')
    expect(generate).not.toHaveBeenCalled()
  })

  it('outside hours → actionType=SILENCE, no Ollama calls', async () => {
    const night = new Date()
    night.setHours(2, 0, 0, 0)
    const result = await runAgentGraph(
      makeDaytimeState({ timeOfDay: night.toISOString() }),
      makeFakeWindow() as never,
      db
    )
    expect(result.actionType).toBe('SILENCE')
    expect(generate).not.toHaveBeenCalled()
  })

  it('all gates pass (IDLE + daytime) → Ollama IS called', async () => {
    await runAgentGraph(makeDaytimeState(), makeFakeWindow() as never, db)
    expect(generate).toHaveBeenCalled()
  })
})

// ─── Full happy path ──────────────────────────────────────────────────────────

describe('full happy path', () => {
  it('generate returns CHECKIN → actionType=CHECKIN', async () => {
    // First call: analyse, Second call: CHECKIN decision, Third call: message
    vi.mocked(generate)
      .mockResolvedValueOnce({ fullText: 'User seems ready for a check-in.', promptTokens: 10, completionTokens: 5, durationMs: 100 })
      .mockResolvedValueOnce({ fullText: 'CHECKIN', promptTokens: 10, completionTokens: 1, durationMs: 50 })
      .mockResolvedValueOnce({ fullText: 'How are you doing today?', promptTokens: 15, completionTokens: 5, durationMs: 100 })

    const result = await runAgentGraph(makeDaytimeState(), makeFakeWindow() as never, db)
    expect(result.actionType).toBe('CHECKIN')
  })

  it('generate returns CELEBRATE → actionType=CELEBRATE', async () => {
    vi.mocked(generate)
      .mockResolvedValueOnce({ fullText: 'User hit a milestone.', promptTokens: 10, completionTokens: 5, durationMs: 100 })
      .mockResolvedValueOnce({ fullText: 'CELEBRATE', promptTokens: 10, completionTokens: 1, durationMs: 50 })
      .mockResolvedValueOnce({ fullText: 'Great work on the project!', promptTokens: 15, completionTokens: 5, durationMs: 100 })

    const result = await runAgentGraph(makeDaytimeState(), makeFakeWindow() as never, db)
    expect(result.actionType).toBe('CELEBRATE')
  })

  it('decide returns SILENCE → message=null, IPC not pushed', async () => {
    vi.mocked(generate)
      .mockResolvedValueOnce({ fullText: 'User seems busy.', promptTokens: 10, completionTokens: 5, durationMs: 100 })
      .mockResolvedValueOnce({ fullText: 'SILENCE', promptTokens: 10, completionTokens: 1, durationMs: 50 })

    const win = makeFakeWindow()
    const result = await runAgentGraph(makeDaytimeState(), win as never, db)

    expect(result.message).toBeNull()
    expect(win.webContents.send).not.toHaveBeenCalledWith('agent:status', expect.anything())
  })

  it('decide returns NUDGE → message non-null, IPC agent:status pushed', async () => {
    vi.mocked(generate)
      .mockResolvedValueOnce({ fullText: 'User could use a nudge.', promptTokens: 10, completionTokens: 5, durationMs: 100 })
      .mockResolvedValueOnce({ fullText: 'NUDGE', promptTokens: 10, completionTokens: 1, durationMs: 50 })
      .mockResolvedValueOnce({ fullText: 'You mentioned wanting to journal more.', promptTokens: 15, completionTokens: 8, durationMs: 100 })

    const win = makeFakeWindow()
    const result = await runAgentGraph(makeDaytimeState(), win as never, db)

    expect(result.message).toBe('You mentioned wanting to journal more.')
    expect(win.webContents.send).toHaveBeenCalledWith('agent:status', expect.objectContaining({
      actionType: 'NUDGE',
      message: 'You mentioned wanting to journal more.'
    }))
  })
})

// ─── Log node ─────────────────────────────────────────────────────────────────

describe('log node', () => {
  it('inserts an agent_event row with correct gate values', async () => {
    vi.mocked(generate)
      .mockResolvedValue({ fullText: 'SILENCE', promptTokens: 5, completionTokens: 1, durationMs: 50 })

    await runAgentGraph(makeDaytimeState(), makeFakeWindow() as never, db)

    const row = db.prepare('SELECT * FROM agent_events ORDER BY id DESC LIMIT 1').get() as Record<string, unknown>
    expect(row).toBeDefined()
    expect(row['gate_1']).toBe('pass')
    expect(row['trigger']).toBe('scheduled')
  })

  it('agent_event run_id matches AgentState.runId', async () => {
    await runAgentGraph(makeDaytimeState({ runId: 'unique-run-abc' }), makeFakeWindow() as never, db)

    const row = db.prepare("SELECT run_id FROM agent_events WHERE run_id = 'unique-run-abc'").get()
    expect(row).toBeDefined()
  })
})

// ─── Error resilience ─────────────────────────────────────────────────────────

describe('error resilience', () => {
  it('Ollama throws on analyse → falls back to SILENCE, does not crash', async () => {
    vi.mocked(generate).mockRejectedValue(new Error('ECONNREFUSED'))

    const result = await runAgentGraph(makeDaytimeState(), makeFakeWindow() as never, db)
    expect(result.actionType).toBe('SILENCE')
  })

  it('retrieveRelevant throws → falls back to empty memories, continues', async () => {
    vi.mocked(retrieveRelevant).mockRejectedValue(new Error('Memory unavailable'))

    vi.mocked(generate)
      .mockResolvedValueOnce({ fullText: 'User doing fine.', promptTokens: 5, completionTokens: 3, durationMs: 50 })
      .mockResolvedValueOnce({ fullText: 'CHECKIN', promptTokens: 5, completionTokens: 1, durationMs: 30 })
      .mockResolvedValueOnce({ fullText: 'How are you?', promptTokens: 5, completionTokens: 3, durationMs: 30 })

    const result = await runAgentGraph(makeDaytimeState(), makeFakeWindow() as never, db)
    expect(result.retrievedMemories).toEqual([])
    // should still complete without error
    expect(['CHECKIN', 'SILENCE']).toContain(result.actionType)
  })
})

/**
 * Agent Integration Tests — Phase 7
 *
 * Full end-to-end cycle with real in-memory DB.
 * Mocks: ollamaClient, embedder, reranker, node-cron, activity monitor.
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

// ─── Mock Ollama ──────────────────────────────────────────────────────────────
vi.mock('../../src/main/chat/ollamaClient', () => ({
  generate:       vi.fn().mockResolvedValue({ fullText: 'CHECKIN', promptTokens: 10, completionTokens: 2, durationMs: 100 }),
  streamGenerate: vi.fn(),
  pingOllama:     vi.fn().mockResolvedValue(true)
}))

// ─── Mock memory ─────────────────────────────────────────────────────────────
vi.mock('../../src/main/memory', () => ({
  retrieveRelevant:        vi.fn().mockResolvedValue({ chunks: [], durationMs: 0 }),
  ingestEntry:             vi.fn(),
  retryPendingEmbeddings:  vi.fn(),
  initMemoryEngine:        vi.fn()
}))

vi.mock('../../src/main/memory/embedder', () => ({ embedText: vi.fn().mockResolvedValue(null) }))

vi.mock('../../src/main/memory/reranker', () => ({
  initReranker:      vi.fn(),
  rerankCandidates:  vi.fn().mockResolvedValue([]),
  isRerankerReady:   vi.fn().mockReturnValue(false),
  terminateReranker: vi.fn().mockResolvedValue(undefined)
}))

// ─── Mock node-cron ───────────────────────────────────────────────────────────
vi.mock('node-cron', () => ({
  default: { schedule: vi.fn().mockReturnValue({ stop: vi.fn() }) },
  schedule: vi.fn().mockReturnValue({ stop: vi.fn() })
}))

// ─── Mock activity monitor ────────────────────────────────────────────────────
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

import { runAgentCycle, startAgentScheduler, stopAgentScheduler } from '../../src/main/agent/index'
import { generate } from '../../src/main/chat/ollamaClient'
import { getCurrentActivity } from '../../src/main/activity'

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

function makeDaytimeIso(): string {
  const now = new Date()
  now.setHours(10, 0, 0, 0)
  return now.toISOString()
}

let db: Database.Database

beforeEach(() => {
  db = openTestDb()
  __setTestDb(db)
  vi.clearAllMocks()
  // Default: 3 LLM calls succeed
  vi.mocked(generate).mockResolvedValue({
    fullText: 'CHECKIN', promptTokens: 10, completionTokens: 2, durationMs: 100
  })
})

afterEach(() => {
  db.close()
  stopAgentScheduler()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runAgentCycle — DEEP_WORK blocks', () => {
  it('DEEP_WORK → SILENCE logged, no LLM called, 1 agent_event inserted', async () => {
    vi.mocked(getCurrentActivity).mockReturnValue({
      state: 'DEEP_WORK', appName: 'VS Code', startedAt: new Date()
    })

    await runAgentCycle('scheduled', makeFakeWindow() as never, db, makeDaytimeIso())

    expect(generate).not.toHaveBeenCalled()
    const row = db.prepare('SELECT action_type FROM agent_events LIMIT 1').get() as { action_type: string }
    expect(row).toBeDefined()
    expect(row.action_type).toBe('SILENCE')
  })
})

describe('runAgentCycle — IDLE happy path', () => {
  it('IDLE + all gates pass → 3 Ollama calls, IPC agent:status pushed', async () => {
    vi.mocked(getCurrentActivity).mockReturnValue({
      state: 'IDLE', appName: 'Finder', startedAt: new Date()
    })
    vi.mocked(generate)
      .mockResolvedValueOnce({ fullText: 'User seems reflective.', promptTokens: 10, completionTokens: 5, durationMs: 80 })
      .mockResolvedValueOnce({ fullText: 'CHECKIN', promptTokens: 10, completionTokens: 1, durationMs: 50 })
      .mockResolvedValueOnce({ fullText: 'How is your day going?', promptTokens: 15, completionTokens: 6, durationMs: 80 })

    const win = makeFakeWindow()
    await runAgentCycle('scheduled', win as never, db, makeDaytimeIso())

    expect(generate).toHaveBeenCalledTimes(3)
    expect(win.webContents.send).toHaveBeenCalledWith('agent:status', expect.objectContaining({
      actionType: 'CHECKIN'
    }))
  })

  it('agent_event has gate_1=pass, gate_2=pass for IDLE + daytime', async () => {
    vi.mocked(getCurrentActivity).mockReturnValue({
      state: 'IDLE', appName: 'Finder', startedAt: new Date()
    })
    vi.mocked(generate)
      .mockResolvedValueOnce({ fullText: 'Fine.', promptTokens: 5, completionTokens: 2, durationMs: 50 })
      .mockResolvedValueOnce({ fullText: 'SILENCE', promptTokens: 5, completionTokens: 1, durationMs: 30 })

    await runAgentCycle('scheduled', makeFakeWindow() as never, db, makeDaytimeIso())

    const row = db.prepare('SELECT gate_1, gate_2 FROM agent_events ORDER BY id DESC LIMIT 1')
      .get() as { gate_1: string; gate_2: string }
    expect(row.gate_1).toBe('pass')
    expect(row.gate_2).toBe('pass')
  })
})

describe('runAgentCycle — gate assertions', () => {
  it('agent_event gate_1=hold for DEEP_WORK', async () => {
    vi.mocked(getCurrentActivity).mockReturnValue({
      state: 'DEEP_WORK', appName: 'VS Code', startedAt: new Date()
    })

    await runAgentCycle('scheduled', makeFakeWindow() as never, db, makeDaytimeIso())

    const row = db.prepare('SELECT gate_1 FROM agent_events ORDER BY id DESC LIMIT 1')
      .get() as { gate_1: string }
    expect(row.gate_1).toBe('hold')
  })

  it('transition path uses 60-min recency threshold (not 120)', async () => {
    vi.mocked(getCurrentActivity).mockReturnValue({
      state: 'IDLE', appName: 'Finder', startedAt: new Date()
    })
    // Set last initiation to 65 minutes before the fixed nowIso (10:00 AM)
    // Using Date.now() would mismatch makeDaytimeIso() if real time < 11:05 AM
    const lastInitiation = new Date(new Date(makeDaytimeIso()).getTime() - 65 * 60 * 1000).toISOString()
    db.prepare(`INSERT INTO agent_events (run_id, trigger, activity_state, action_type, gate_1, gate_2, gate_3, gate_4, gate_5, created_at) VALUES ('prev','scheduled','IDLE','CHECKIN','pass','pass','pass','pass','pass',?)`).run(lastInitiation)

    vi.mocked(generate)
      .mockResolvedValue({ fullText: 'SILENCE', promptTokens: 5, completionTokens: 1, durationMs: 30 })

    // With transition trigger (60-min threshold), 65 min ago → pass
    await runAgentCycle('transition', makeFakeWindow() as never, db, makeDaytimeIso())

    const rows = db.prepare('SELECT gate_3, trigger FROM agent_events ORDER BY id DESC LIMIT 1').get() as { gate_3: string; trigger: string }
    expect(rows.trigger).toBe('transition')
    expect(rows.gate_3).toBe('pass')
  })

  it('5 consecutive dismissals → gate_5=hold, SILENCE, no LLM', async () => {
    vi.mocked(getCurrentActivity).mockReturnValue({
      state: 'IDLE', appName: 'Finder', startedAt: new Date()
    })
    // Insert 5 dismissed events
    for (let i = 0; i < 5; i++) {
      db.prepare(`INSERT INTO agent_events (run_id, trigger, activity_state, action_type, gate_1, gate_2, gate_3, gate_4, gate_5, user_response) VALUES (?,  'scheduled', 'IDLE', 'CHECKIN', 'pass', 'pass', 'pass', 'pass', 'pass', 'dismissed')`).run(`dismissed-${i}`)
    }

    await runAgentCycle('scheduled', makeFakeWindow() as never, db, makeDaytimeIso())

    expect(generate).not.toHaveBeenCalled()
    const row = db.prepare('SELECT gate_5, action_type FROM agent_events ORDER BY id DESC LIMIT 1').get() as { gate_5: string; action_type: string }
    expect(row.gate_5).toBe('hold')
    expect(row.action_type).toBe('SILENCE')
  })
})

describe('runAgentCycle — trigger logging', () => {
  it('scheduled trigger logged correctly', async () => {
    vi.mocked(getCurrentActivity).mockReturnValue({
      state: 'DEEP_WORK', appName: 'VS Code', startedAt: new Date()
    })

    await runAgentCycle('scheduled', makeFakeWindow() as never, db, makeDaytimeIso())

    const row = db.prepare("SELECT trigger FROM agent_events ORDER BY id DESC LIMIT 1").get() as { trigger: string }
    expect(row.trigger).toBe('scheduled')
  })

  it('transition trigger logged correctly', async () => {
    vi.mocked(getCurrentActivity).mockReturnValue({
      state: 'DEEP_WORK', appName: 'VS Code', startedAt: new Date()
    })

    await runAgentCycle('transition', makeFakeWindow() as never, db, makeDaytimeIso())

    const row = db.prepare("SELECT trigger FROM agent_events ORDER BY id DESC LIMIT 1").get() as { trigger: string }
    expect(row.trigger).toBe('transition')
  })
})

describe('runAgentCycle — SILENCE cycle', () => {
  it('SILENCE cycle: agent_event has action_type=SILENCE, message_generated=null', async () => {
    vi.mocked(getCurrentActivity).mockReturnValue({
      state: 'GAMING', appName: 'Steam', startedAt: new Date()
    })

    await runAgentCycle('scheduled', makeFakeWindow() as never, db, makeDaytimeIso())

    const row = db.prepare('SELECT action_type, message_generated FROM agent_events ORDER BY id DESC LIMIT 1')
      .get() as { action_type: string; message_generated: string | null }
    expect(row.action_type).toBe('SILENCE')
    expect(row.message_generated).toBeNull()
  })
})

describe('startAgentScheduler', () => {
  it('registers cron job without throwing', () => {
    expect(() => startAgentScheduler(makeFakeWindow() as never)).not.toThrow()
  })

  it('stopAgentScheduler does not throw', () => {
    startAgentScheduler(makeFakeWindow() as never)
    expect(() => stopAgentScheduler()).not.toThrow()
  })
})

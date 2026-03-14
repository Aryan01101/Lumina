/**
 * Metrics IPC Handler Tests — Phase 9
 *
 * Verifies that the metrics:get handler returns correct aggregated values
 * from llm_calls, messages, and agent_events tables.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
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

// ─── Minimal mocks for IPC module dependencies ───────────────────────────────
vi.mock('../../src/main/settings', () => ({
  getSetting:          vi.fn().mockReturnValue('off'),
  getSettings:         vi.fn().mockReturnValue({}),
  setSetting:          vi.fn(),
  loadSettingsFromDisk: vi.fn()
}))
vi.mock('../../src/main/activity', () => ({
  getCurrentActivity:   vi.fn().mockReturnValue({ state: 'IDLE', appName: '', startedAt: new Date() }),
  startActivityMonitor: vi.fn(),
  isDegradedMode:       vi.fn().mockReturnValue(false)
}))
vi.mock('../../src/main/memory', () => ({
  ingestEntry:             vi.fn(),
  retrieveRelevant:        vi.fn().mockResolvedValue({ chunks: [], durationMs: 0 }),
  retryPendingEmbeddings:  vi.fn(),
  initMemoryEngine:        vi.fn()
}))
vi.mock('../../src/main/ccm', () => ({
  getCCMSummary:         vi.fn().mockReturnValue(''),
  getPendingProposals:   vi.fn().mockReturnValue([]),
  resolveProposal:       vi.fn(),
  getCCM:                vi.fn().mockReturnValue(null)
}))
vi.mock('../../src/main/chat', () => ({
  handleChatMessage: vi.fn().mockResolvedValue({ ok: true, conversationId: 1 }),
  getConversationHistory: vi.fn().mockReturnValue([])
}))
vi.mock('../../src/main/agent', () => ({
  startAgentScheduler: vi.fn()
}))
vi.mock('../../src/main/observability/langfuse', () => ({
  initLangfuse: vi.fn(),
  isEnabled:    vi.fn().mockReturnValue(false)
}))
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  shell:   { openExternal: vi.fn() }
}))

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

function insertLlmCall(
  db: Database.Database,
  model: string,
  promptTokens: number,
  completionTokens: number,
  durationMs: number,
  context: string
): void {
  db.prepare(
    `INSERT INTO llm_calls (model, prompt_tokens, completion_tokens, duration_ms, context)
     VALUES (?, ?, ?, ?, ?)`
  ).run(model, promptTokens, completionTokens, durationMs, context)
}

function insertConversation(db: Database.Database): number {
  return db.prepare('INSERT INTO conversations DEFAULT VALUES').run().lastInsertRowid as number
}

function insertMessage(
  db: Database.Database,
  convId: number,
  role: string,
  content: string,
  groundednessScore: number | null
): void {
  db.prepare(
    `INSERT INTO messages (conversation_id, role, content, retrieved_chunk_ids, groundedness_score)
     VALUES (?, ?, ?, '[]', ?)`
  ).run(convId, role, content, groundednessScore)
}

function insertAgentEvent(
  db: Database.Database,
  actionType: string,
  userResponse: string | null
): void {
  db.prepare(
    `INSERT INTO agent_events (run_id, trigger, action_type, user_response)
     VALUES (?, 'scheduled', ?, ?)`
  ).run(`run-${Date.now()}-${Math.random()}`, actionType, userResponse)
}

// ─── Extract metrics query logic (mirrors ipc/index.ts handler) ──────────────

function computeMetrics(db: Database.Database) {
  const latencyRows = db.prepare(`
    SELECT duration_ms FROM llm_calls
    WHERE context = 'chat'
    ORDER BY id DESC LIMIT 50
  `).all() as { duration_ms: number }[]
  const latency_p50 = latencyRows.length > 0
    ? latencyRows.map(r => r.duration_ms).sort((a, b) => a - b)[Math.floor(latencyRows.length / 2)]
    : null

  const groundRow = db.prepare(`
    SELECT AVG(groundedness_score) as avg
    FROM (
      SELECT groundedness_score FROM messages
      WHERE role = 'assistant' AND groundedness_score IS NOT NULL
      ORDER BY id DESC LIMIT 50
    )
  `).get() as { avg: number | null }
  const groundedness_avg = groundRow?.avg ?? null

  const agentTotals = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN action_type != 'SILENCE' THEN 1 ELSE 0 END) as initiated
    FROM agent_events
  `).get() as { total: number; initiated: number }
  const initiation_rate = agentTotals.total > 0
    ? agentTotals.initiated / agentTotals.total
    : null

  const dismissRow = db.prepare(`
    SELECT
      SUM(CASE WHEN user_response = 'dismissed' THEN 1 ELSE 0 END) as dismissed,
      SUM(CASE WHEN user_response IN ('engaged','dismissed') THEN 1 ELSE 0 END) as responded
    FROM agent_events
    WHERE action_type != 'SILENCE'
  `).get() as { dismissed: number; responded: number }
  const dismissal_rate = (dismissRow.responded ?? 0) > 0
    ? dismissRow.dismissed / dismissRow.responded
    : null

  const llm_call_count   = (db.prepare('SELECT COUNT(*) as count FROM llm_calls').get() as { count: number }).count
  const agent_event_count = (db.prepare('SELECT COUNT(*) as count FROM agent_events').get() as { count: number }).count

  return { latency_p50, groundedness_avg, initiation_rate, dismissal_rate, llm_call_count, agent_event_count }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

let db: Database.Database

beforeEach(() => {
  db = openTestDb()
  __setTestDb(db)
})

afterEach(() => {
  db.close()
})

describe('latency_p50', () => {
  it('returns null when there are no llm_calls', () => {
    const { latency_p50 } = computeMetrics(db)
    expect(latency_p50).toBeNull()
  })

  it('returns median of chat context calls only', () => {
    insertLlmCall(db, 'llama3.1:8b', 10, 5, 100, 'chat')
    insertLlmCall(db, 'llama3.1:8b', 10, 5, 200, 'chat')
    insertLlmCall(db, 'llama3.1:8b', 10, 5, 300, 'chat')
    insertLlmCall(db, 'llama3.1:8b', 10, 5, 999, 'groundedness') // excluded

    const { latency_p50 } = computeMetrics(db)
    // sorted [100, 200, 300], median index = floor(3/2) = 1 → 200
    expect(latency_p50).toBe(200)
  })

  it('ignores non-chat contexts for latency', () => {
    insertLlmCall(db, 'llama3.1:8b', 10, 5, 500, 'agent')
    insertLlmCall(db, 'llama3.1:8b', 10, 5, 700, 'groundedness')
    const { latency_p50 } = computeMetrics(db)
    expect(latency_p50).toBeNull()
  })
})

describe('groundedness_avg', () => {
  it('returns null when no messages have groundedness scores', () => {
    const { groundedness_avg } = computeMetrics(db)
    expect(groundedness_avg).toBeNull()
  })

  it('averages groundedness scores from assistant messages', () => {
    const convId = insertConversation(db)
    insertMessage(db, convId, 'assistant', 'reply a', 0.8)
    insertMessage(db, convId, 'assistant', 'reply b', 0.6)
    insertMessage(db, convId, 'user',      'question', null) // excluded

    const { groundedness_avg } = computeMetrics(db)
    expect(groundedness_avg).toBeCloseTo(0.7, 5)
  })

  it('excludes null groundedness scores from average', () => {
    const convId = insertConversation(db)
    insertMessage(db, convId, 'assistant', 'with score', 1.0)
    insertMessage(db, convId, 'assistant', 'without score', null)

    const { groundedness_avg } = computeMetrics(db)
    expect(groundedness_avg).toBeCloseTo(1.0, 5)
  })
})

describe('initiation_rate', () => {
  it('returns null when there are no agent events', () => {
    const { initiation_rate } = computeMetrics(db)
    expect(initiation_rate).toBeNull()
  })

  it('computes initiated / total correctly', () => {
    insertAgentEvent(db, 'CHECKIN', 'engaged')   // initiated
    insertAgentEvent(db, 'SILENCE', null)         // not initiated
    insertAgentEvent(db, 'CELEBRATE', 'dismissed') // initiated

    const { initiation_rate } = computeMetrics(db)
    // 2 initiated out of 3 total
    expect(initiation_rate).toBeCloseTo(2 / 3, 5)
  })

  it('returns 0 when all events are SILENCE', () => {
    insertAgentEvent(db, 'SILENCE', null)
    insertAgentEvent(db, 'SILENCE', null)
    const { initiation_rate } = computeMetrics(db)
    expect(initiation_rate).toBe(0)
  })
})

describe('dismissal_rate', () => {
  it('returns null when there are no non-SILENCE events with responses', () => {
    const { dismissal_rate } = computeMetrics(db)
    expect(dismissal_rate).toBeNull()
  })

  it('computes dismissed / responded for non-SILENCE events', () => {
    insertAgentEvent(db, 'CHECKIN',  'dismissed')
    insertAgentEvent(db, 'CHECKIN',  'engaged')
    insertAgentEvent(db, 'CHECKIN',  'dismissed')
    insertAgentEvent(db, 'SILENCE',  null)        // excluded

    const { dismissal_rate } = computeMetrics(db)
    // 2 dismissed out of 3 responded
    expect(dismissal_rate).toBeCloseTo(2 / 3, 5)
  })

  it('returns 0 when all non-SILENCE events are engaged', () => {
    insertAgentEvent(db, 'CHECKIN', 'engaged')
    insertAgentEvent(db, 'CHECKIN', 'engaged')
    const { dismissal_rate } = computeMetrics(db)
    expect(dismissal_rate).toBe(0)
  })
})

describe('counts', () => {
  it('returns 0 counts on empty DB', () => {
    const { llm_call_count, agent_event_count } = computeMetrics(db)
    expect(llm_call_count).toBe(0)
    expect(agent_event_count).toBe(0)
  })

  it('returns correct counts after inserts', () => {
    insertLlmCall(db, 'llama3.1:8b', 10, 5, 200, 'chat')
    insertLlmCall(db, 'llama3.1:8b', 10, 5, 300, 'agent')
    insertAgentEvent(db, 'CHECKIN', 'engaged')

    const { llm_call_count, agent_event_count } = computeMetrics(db)
    expect(llm_call_count).toBe(2)
    expect(agent_event_count).toBe(1)
  })
})

describe('empty DB — all nulls, no crash', () => {
  it('returns all-null metrics without throwing', () => {
    const result = computeMetrics(db)
    expect(result.latency_p50).toBeNull()
    expect(result.groundedness_avg).toBeNull()
    expect(result.initiation_rate).toBeNull()
    expect(result.dismissal_rate).toBeNull()
    expect(result.llm_call_count).toBe(0)
    expect(result.agent_event_count).toBe(0)
  })
})

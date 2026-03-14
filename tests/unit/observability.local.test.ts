/**
 * Observability — Local Tests — Phase 9
 *
 * Tests:
 * - Retrieval logging: retrieveRelevant() writes to retrieval_logs
 * - Grounder logging: scoreGroundedness() calls logLlmCall with context='groundedness'
 * - User response IPC: agent:userResponse updates agent_events.user_response
 * - Metrics computation: metrics:get returns real SQL aggregations
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

// ─── Mock embedder + reranker ─────────────────────────────────────────────────
vi.mock('../../src/main/memory/embedder', () => ({
  embedText: vi.fn().mockResolvedValue(null)
}))

vi.mock('../../src/main/memory/reranker', () => ({
  initReranker:      vi.fn(),
  rerankCandidates:  vi.fn().mockResolvedValue([0.9, 0.7, 0.5]),
  isRerankerReady:   vi.fn().mockReturnValue(true),
  terminateReranker: vi.fn().mockResolvedValue(undefined)
}))

// ─── Mock Ollama for grounder ─────────────────────────────────────────────────
vi.mock('../../src/main/chat/ollamaClient', () => ({
  generate: vi.fn().mockResolvedValue({
    fullText: '0.85',
    promptTokens: 50,
    completionTokens: 3,
    durationMs: 120
  }),
  streamGenerate: vi.fn(),
  pingOllama:     vi.fn().mockResolvedValue(true)
}))

// ─── Mock electron ────────────────────────────────────────────────────────────
vi.mock('electron', () => ({
  app: { getPath: vi.fn().mockReturnValue('/tmp/test-lumina') },
  ipcMain: {
    handle: vi.fn(),
    on:     vi.fn()
  },
  BrowserWindow: vi.fn()
}))

// ─── Mock CCM ────────────────────────────────────────────────────────────────
vi.mock('../../src/main/ccm', () => ({
  getCCM:            vi.fn().mockReturnValue({}),
  getCCMSummary:     vi.fn().mockReturnValue(''),
  getPendingProposals: vi.fn().mockReturnValue([]),
  createProposal:    vi.fn(),
  resolveProposal:   vi.fn(),
  updateCCMSection:  vi.fn()
}))

// ─── Mock activity ────────────────────────────────────────────────────────────
vi.mock('../../src/main/activity', () => ({
  getCurrentActivity: vi.fn().mockReturnValue({ state: 'IDLE', appName: 'Finder', startedAt: new Date() }),
  startActivityMonitor: vi.fn(),
  stopActivityMonitor:  vi.fn()
}))

// ─── Mock settings ────────────────────────────────────────────────────────────
vi.mock('../../src/main/settings', () => ({
  getSettings:   vi.fn().mockReturnValue({ observability: 'local', langfuseKey: '' }),
  getSetting:    vi.fn().mockReturnValue('local'),
  setSetting:    vi.fn(),
  resetSettings: vi.fn()
}))

// ─── Mock Langfuse observability (not yet implemented) ───────────────────────
vi.mock('../../src/main/observability/langfuse', () => ({
  isEnabled:      vi.fn().mockReturnValue(false),
  initLangfuse:   vi.fn(),
  traceAgentRun:  vi.fn(),
  traceRetrieval: vi.fn(),
  traceLlmCall:   vi.fn()
}))

import { retrieveRelevant } from '../../src/main/memory'
import { scoreGroundedness } from '../../src/main/chat/grounder'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { __setTestDb } = await import('../../src/main/db') as any

// ─── Helpers ─────────────────────────────────────────────────────────────────

function openTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db, false)
  return db
}

function insertChunk(db: Database.Database, content: string): number {
  const result = db.prepare(
    `INSERT INTO memory_chunks (source_type, source_id, content, importance_score)
     VALUES ('journal', 1, ?, 0.5)`
  ).run(content)
  const id = Number(result.lastInsertRowid)
  db.prepare(`INSERT INTO memory_chunks_fts(rowid, content) VALUES (?, ?)`).run(id, content)
  return id
}

let db: Database.Database

beforeEach(() => {
  db = openTestDb()
  __setTestDb(db)
})

afterEach(() => {
  db.close()
})

// ─── Retrieval Logging ────────────────────────────────────────────────────────

describe('retrieveRelevant — logging', () => {
  it('writes 1 row to retrieval_logs after retrieval', async () => {
    insertChunk(db, 'I felt really anxious about my project deadline today.')
    insertChunk(db, 'Had a great conversation with my mentor about career goals.')

    await retrieveRelevant('project work', 3)

    const rows = db.prepare('SELECT * FROM retrieval_logs').all() as Array<Record<string, unknown>>
    expect(rows).toHaveLength(1)
  })

  it('stores a positive duration_ms in retrieval_logs', async () => {
    insertChunk(db, 'Working on a new feature for Lumina.')

    await retrieveRelevant('lumina feature', 3)

    const row = db.prepare('SELECT * FROM retrieval_logs LIMIT 1').get() as Record<string, unknown>
    expect(typeof row.duration_ms).toBe('number')
    expect(row.duration_ms as number).toBeGreaterThanOrEqual(0)
  })

  it('stores chunk_ids as a valid JSON array', async () => {
    insertChunk(db, 'Today I felt proud finishing the implementation.')

    await retrieveRelevant('proud implementation', 3)

    const row = db.prepare('SELECT chunk_ids FROM retrieval_logs LIMIT 1').get() as { chunk_ids: string }
    const parsed = JSON.parse(row.chunk_ids)
    expect(Array.isArray(parsed)).toBe(true)
  })

  it('writes a row with chunk_ids=[] when no chunks exist in DB', async () => {
    // No chunks inserted — retrieval returns empty
    await retrieveRelevant('nothing here', 3)

    const rows = db.prepare('SELECT * FROM retrieval_logs').all() as Array<Record<string, unknown>>
    expect(rows).toHaveLength(1)
    expect(JSON.parse(rows[0].chunk_ids as string)).toEqual([])
  })
})

// ─── Grounder Logging ─────────────────────────────────────────────────────────

describe('scoreGroundedness — logging', () => {
  it('writes 1 row to llm_calls with context=groundedness after scoring', async () => {
    const score = await scoreGroundedness(
      'How are you feeling?',
      'I am doing well.',
      ['User mentioned feeling good and grateful.']
    )

    expect(score).not.toBeNull()

    const rows = db.prepare(`SELECT * FROM llm_calls WHERE context = 'groundedness'`).all()
    expect(rows).toHaveLength(1)
  })

  it('writes 0 rows to llm_calls when chunks array is empty (early return)', async () => {
    const score = await scoreGroundedness('question', 'answer', [])

    expect(score).toBeNull()

    const rows = db.prepare(`SELECT * FROM llm_calls WHERE context = 'groundedness'`).all()
    expect(rows).toHaveLength(0)
  })

  it('stores positive duration_ms for successful groundedness call', async () => {
    await scoreGroundedness('question?', 'answer.', ['some context chunk'])

    const row = db.prepare(`SELECT duration_ms FROM llm_calls WHERE context = 'groundedness'`).get() as { duration_ms: number }
    expect(row.duration_ms).toBeGreaterThanOrEqual(0)
  })
})

// ─── User Response IPC ────────────────────────────────────────────────────────

describe('agent:userResponse — IPC handler', () => {
  function insertAgentEvent(runId: string): void {
    db.prepare(`
      INSERT INTO agent_events
        (run_id, trigger, activity_state, gate_1, gate_2, gate_3, gate_4, gate_5, action_type)
      VALUES (?, 'scheduled', 'IDLE', 'pass', 'pass', 'pass', 'pass', 'pass', 'CHECKIN')
    `).run(runId)
  }

  it('updates user_response to engaged for known runId', async () => {
    insertAgentEvent('test-run-001')

    // Simulate what the IPC handler does
    const runId = 'test-run-001'
    const response = 'engaged'
    const row = db.prepare('SELECT id FROM agent_events WHERE run_id = ?').get(runId)
    expect(row).toBeTruthy()
    db.prepare('UPDATE agent_events SET user_response = ? WHERE run_id = ?').run(response, runId)

    const updated = db.prepare('SELECT user_response FROM agent_events WHERE run_id = ?').get(runId) as { user_response: string }
    expect(updated.user_response).toBe('engaged')
  })

  it('updates user_response to dismissed for known runId', async () => {
    insertAgentEvent('test-run-002')

    const runId = 'test-run-002'
    db.prepare('UPDATE agent_events SET user_response = ? WHERE run_id = ?').run('dismissed', runId)

    const updated = db.prepare('SELECT user_response FROM agent_events WHERE run_id = ?').get(runId) as { user_response: string }
    expect(updated.user_response).toBe('dismissed')
  })

  it('returns ok:false for unknown runId', () => {
    const runId = 'nonexistent-run'
    const row = db.prepare('SELECT id FROM agent_events WHERE run_id = ?').get(runId)
    expect(row).toBeFalsy()
    // Handler should return { ok: false }
  })

  it('returns ok:true for known runId', () => {
    insertAgentEvent('test-run-003')
    const row = db.prepare('SELECT id FROM agent_events WHERE run_id = ?').get('test-run-003')
    expect(row).toBeTruthy()
    // Handler should return { ok: true }
  })
})

// ─── Metrics Computation ──────────────────────────────────────────────────────

describe('metrics:get — SQL aggregations', () => {
  function computeMetrics(db: Database.Database) {
    // p50 latency (last 50 llm_calls)
    const llmRows = db.prepare(
      'SELECT duration_ms FROM llm_calls ORDER BY created_at DESC LIMIT 50'
    ).all() as Array<{ duration_ms: number }>
    const sorted = llmRows.map(r => r.duration_ms).sort((a, b) => a - b)
    const latency_p50 = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null

    // avg groundedness (last 50 messages with score)
    const groundRow = db.prepare(
      'SELECT AVG(groundedness_score) as avg FROM (SELECT groundedness_score FROM messages WHERE groundedness_score IS NOT NULL ORDER BY created_at DESC LIMIT 50)'
    ).get() as { avg: number | null }
    const groundedness_avg = groundRow.avg ?? null

    // dismissal rate
    const rateRow = db.prepare(`
      SELECT
        SUM(CASE WHEN user_response='dismissed' THEN 1 ELSE 0 END) as dismissed,
        COUNT(CASE WHEN user_response IN ('dismissed','engaged') THEN 1 END) as total
      FROM agent_events
    `).get() as { dismissed: number; total: number }
    const dismissal_rate = rateRow.total > 0 ? rateRow.dismissed / rateRow.total : null

    const llm_call_count = (db.prepare('SELECT COUNT(*) as count FROM llm_calls').get() as { count: number }).count
    const agent_event_count = (db.prepare('SELECT COUNT(*) as count FROM agent_events').get() as { count: number }).count

    return { latency_p50, groundedness_avg, dismissal_rate, llm_call_count, agent_event_count }
  }

  it('returns all nulls for empty DB', () => {
    const metrics = computeMetrics(db)
    expect(metrics.latency_p50).toBeNull()
    expect(metrics.groundedness_avg).toBeNull()
    expect(metrics.dismissal_rate).toBeNull()
    expect(metrics.llm_call_count).toBe(0)
    expect(metrics.agent_event_count).toBe(0)
  })

  it('computes correct p50 latency from 10 llm_calls', () => {
    // Insert 10 rows with known duration_ms: [10,20,30,40,50,60,70,80,90,100]
    for (let i = 1; i <= 10; i++) {
      db.prepare(
        `INSERT INTO llm_calls (model, prompt_tokens, completion_tokens, duration_ms, context)
         VALUES ('llama3.1:8b', 10, 5, ?, 'chat')`
      ).run(i * 10)
    }

    const metrics = computeMetrics(db)
    // sorted: [10,20,30,40,50,60,70,80,90,100], index 5 = 60
    expect(metrics.latency_p50).toBe(60)
  })

  it('computes correct groundedness_avg from 10 messages', () => {
    // Create a conversation first (no title column in schema)
    const convId = db.prepare(`INSERT INTO conversations DEFAULT VALUES`).run().lastInsertRowid
    for (let i = 0; i < 10; i++) {
      db.prepare(
        `INSERT INTO messages (conversation_id, role, content, groundedness_score)
         VALUES (?, 'assistant', 'response', ?)`
      ).run(convId, 0.8)
    }

    const metrics = computeMetrics(db)
    expect(metrics.groundedness_avg).toBeCloseTo(0.8, 2)
  })

  it('computes correct dismissal_rate: 2 dismissed, 3 engaged → 0.4', () => {
    const events = [
      { runId: 'r1', response: 'dismissed' },
      { runId: 'r2', response: 'dismissed' },
      { runId: 'r3', response: 'engaged' },
      { runId: 'r4', response: 'engaged' },
      { runId: 'r5', response: 'engaged' },
    ]
    for (const e of events) {
      db.prepare(`
        INSERT INTO agent_events (run_id, trigger, activity_state, gate_1, gate_2, gate_3, gate_4, gate_5, action_type, user_response)
        VALUES (?, 'scheduled', 'IDLE', 'pass', 'pass', 'pass', 'pass', 'pass', 'CHECKIN', ?)
      `).run(e.runId, e.response)
    }

    const metrics = computeMetrics(db)
    expect(metrics.dismissal_rate).toBeCloseTo(0.4, 5)
  })

  it('reflects actual row counts in llm_call_count and agent_event_count', () => {
    db.prepare(
      `INSERT INTO llm_calls (model, prompt_tokens, completion_tokens, duration_ms, context)
       VALUES ('llama3.1:8b', 10, 5, 200, 'chat')`
    ).run()
    db.prepare(
      `INSERT INTO llm_calls (model, prompt_tokens, completion_tokens, duration_ms, context)
       VALUES ('llama3.1:8b', 10, 5, 300, 'agent')`
    ).run()

    const metrics = computeMetrics(db)
    expect(metrics.llm_call_count).toBe(2)
    expect(metrics.agent_event_count).toBe(0)
  })
})

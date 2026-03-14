/**
 * Agent Observer Tests — Phase 7
 *
 * DB read functions — real in-memory SQLite, no mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../src/main/db/migrations'
import {
  getMoodTrend,
  getLastJournalAt,
  getLastConversationAt,
  getLastInitiationAt,
  getConsecutiveDismissals
} from '../../src/main/agent/observer'

function openTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db, false)
  return db
}

let db: Database.Database

beforeEach(() => { db = openTestDb() })
afterEach(() => { db.close() })

// ─── getMoodTrend ─────────────────────────────────────────────────────────────

describe('getMoodTrend', () => {
  it('returns { avg: null, direction: null } when no mood logs', () => {
    const result = getMoodTrend(db, 7)
    expect(result.avg).toBeNull()
    expect(result.direction).toBeNull()
  })

  it('returns flat direction when all entries are the same', () => {
    const now = new Date()
    for (let i = 0; i < 3; i++) {
      db.prepare("INSERT INTO mood_logs (source, raw_value, normalised_score, created_at) VALUES ('emoji_vibe','good',0.75,?)")
        .run(new Date(now.getTime() - i * 60_000).toISOString())
    }
    const result = getMoodTrend(db, 7)
    expect(result.avg).toBeCloseTo(0.75, 2)
    expect(result.direction).toBe('flat')
  })

  it('returns "up" direction for rising scores', () => {
    const now = Date.now()
    // Insert oldest first (lowest score)
    db.prepare("INSERT INTO mood_logs (source, raw_value, normalised_score, created_at) VALUES ('emoji_vibe','frustrated',0.25,?)").run(new Date(now - 3 * 60_000).toISOString())
    db.prepare("INSERT INTO mood_logs (source, raw_value, normalised_score, created_at) VALUES ('emoji_vibe','okay',0.5,?)").run(new Date(now - 2 * 60_000).toISOString())
    db.prepare("INSERT INTO mood_logs (source, raw_value, normalised_score, created_at) VALUES ('emoji_vibe','good',0.75,?)").run(new Date(now - 1 * 60_000).toISOString())

    const result = getMoodTrend(db, 7)
    expect(result.direction).toBe('up')
  })

  it('returns "down" direction for falling scores', () => {
    const now = Date.now()
    db.prepare("INSERT INTO mood_logs (source, raw_value, normalised_score, created_at) VALUES ('emoji_vibe','good',0.75,?)").run(new Date(now - 3 * 60_000).toISOString())
    db.prepare("INSERT INTO mood_logs (source, raw_value, normalised_score, created_at) VALUES ('emoji_vibe','okay',0.5,?)").run(new Date(now - 2 * 60_000).toISOString())
    db.prepare("INSERT INTO mood_logs (source, raw_value, normalised_score, created_at) VALUES ('emoji_vibe','frustrated',0.25,?)").run(new Date(now - 1 * 60_000).toISOString())

    const result = getMoodTrend(db, 7)
    expect(result.direction).toBe('down')
  })
})

// ─── getLastJournalAt ─────────────────────────────────────────────────────────

describe('getLastJournalAt', () => {
  it('returns null when no journal entries exist', () => {
    expect(getLastJournalAt(db)).toBeNull()
  })

  it('returns the most recent entry\'s created_at timestamp', () => {
    const older = new Date(Date.now() - 60_000).toISOString()
    const newer = new Date().toISOString()
    db.prepare("INSERT INTO journal_entries (mode, content, created_at) VALUES ('freeform','old entry',?)").run(older)
    db.prepare("INSERT INTO journal_entries (mode, content, created_at) VALUES ('freeform','new entry',?)").run(newer)

    const result = getLastJournalAt(db)
    expect(result).not.toBeNull()
    expect(new Date(result!).getTime()).toBeGreaterThanOrEqual(new Date(older).getTime())
  })
})

// ─── getLastConversationAt ────────────────────────────────────────────────────

describe('getLastConversationAt', () => {
  it('returns null when no messages exist', () => {
    expect(getLastConversationAt(db)).toBeNull()
  })

  it('returns the most recent message created_at', () => {
    const convId = db.prepare('INSERT INTO conversations DEFAULT VALUES').run().lastInsertRowid
    const older = new Date(Date.now() - 60_000).toISOString()
    const newer = new Date().toISOString()
    db.prepare("INSERT INTO messages (conversation_id, role, content, retrieved_chunk_ids, created_at) VALUES (?, 'user', 'hi', '[]', ?)").run(convId, older)
    db.prepare("INSERT INTO messages (conversation_id, role, content, retrieved_chunk_ids, created_at) VALUES (?, 'assistant', 'hello', '[]', ?)").run(convId, newer)

    const result = getLastConversationAt(db)
    expect(result).not.toBeNull()
  })
})

// ─── getLastInitiationAt ──────────────────────────────────────────────────────

describe('getLastInitiationAt', () => {
  it('returns null when no agent_events exist', () => {
    expect(getLastInitiationAt(db)).toBeNull()
  })

  it('returns created_at of the most recent non-SILENCE event', () => {
    const runId = 'test-run-1'
    db.prepare(`
      INSERT INTO agent_events (run_id, trigger, activity_state, action_type, gate_1, gate_2, gate_3, gate_4, gate_5)
      VALUES (?, 'scheduled', 'IDLE', 'CHECKIN', 'pass', 'pass', 'pass', 'pass', 'pass')
    `).run(runId)

    const result = getLastInitiationAt(db)
    expect(result).not.toBeNull()
    expect(typeof result).toBe('string')
  })

  it('ignores SILENCE events', () => {
    db.prepare(`
      INSERT INTO agent_events (run_id, trigger, activity_state, action_type, gate_1)
      VALUES ('run-1', 'scheduled', 'DEEP_WORK', 'SILENCE', 'hold')
    `).run()

    expect(getLastInitiationAt(db)).toBeNull()
  })
})

// ─── getConsecutiveDismissals ─────────────────────────────────────────────────

describe('getConsecutiveDismissals', () => {
  it('returns 0 when no events', () => {
    expect(getConsecutiveDismissals(db)).toBe(0)
  })

  it('returns 0 when most recent event was engaged', () => {
    db.prepare(`INSERT INTO agent_events (run_id, trigger, activity_state, action_type, gate_1, gate_2, gate_3, gate_4, gate_5, user_response) VALUES ('r1','scheduled','IDLE','CHECKIN','pass','pass','pass','pass','pass','dismissed')`).run()
    db.prepare(`INSERT INTO agent_events (run_id, trigger, activity_state, action_type, gate_1, gate_2, gate_3, gate_4, gate_5, user_response) VALUES ('r2','scheduled','IDLE','CHECKIN','pass','pass','pass','pass','pass','dismissed')`).run()
    db.prepare(`INSERT INTO agent_events (run_id, trigger, activity_state, action_type, gate_1, gate_2, gate_3, gate_4, gate_5, user_response) VALUES ('r3','scheduled','IDLE','CHECKIN','pass','pass','pass','pass','pass','engaged')`).run()

    expect(getConsecutiveDismissals(db)).toBe(0)
  })

  it('returns 3 when 3 consecutive dismissed events at top', () => {
    db.prepare(`INSERT INTO agent_events (run_id, trigger, activity_state, action_type, gate_1, gate_2, gate_3, gate_4, gate_5, user_response) VALUES ('r0','scheduled','IDLE','CHECKIN','pass','pass','pass','pass','pass','engaged')`).run()
    db.prepare(`INSERT INTO agent_events (run_id, trigger, activity_state, action_type, gate_1, gate_2, gate_3, gate_4, gate_5, user_response) VALUES ('r1','scheduled','IDLE','CHECKIN','pass','pass','pass','pass','pass','dismissed')`).run()
    db.prepare(`INSERT INTO agent_events (run_id, trigger, activity_state, action_type, gate_1, gate_2, gate_3, gate_4, gate_5, user_response) VALUES ('r2','scheduled','IDLE','CHECKIN','pass','pass','pass','pass','pass','dismissed')`).run()
    db.prepare(`INSERT INTO agent_events (run_id, trigger, activity_state, action_type, gate_1, gate_2, gate_3, gate_4, gate_5, user_response) VALUES ('r3','scheduled','IDLE','CHECKIN','pass','pass','pass','pass','pass','dismissed')`).run()

    expect(getConsecutiveDismissals(db)).toBe(3)
  })
})

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../src/main/db/migrations'

// Retention functions use getDb() internally — we mock the db module
// to inject our in-memory test database.
vi.mock('../../src/main/db', () => {
  let _db: Database.Database | null = null
  return {
    getDb: () => {
      if (!_db) throw new Error('Test DB not set')
      return _db
    },
    __setTestDb: (db: Database.Database) => {
      _db = db
    }
  }
})

// Also mock node-cron so scheduleWeeklyRebuild doesn't spin up real crons in tests
vi.mock('node-cron', () => ({
  default: { schedule: vi.fn() },
  schedule: vi.fn()
}))

import { checkChunkCap, purgeOldMessages, purgeOldSessions, scheduleWeeklyRebuild } from '../../src/main/memory/retention'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { __setTestDb } = await import('../../src/main/db') as any

function openTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  let vecAvailable = false
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sqliteVec = require('sqlite-vec')
    sqliteVec.load(db)
    vecAvailable = true
  } catch {
    vecAvailable = false
  }

  runMigrations(db, vecAvailable)
  return db
}

function insertChunk(db: Database.Database, importanceScore = 0.5): number {
  const result = db
    .prepare(
      `INSERT INTO memory_chunks (source_type, source_id, content, importance_score)
       VALUES ('journal', 1, 'test content', ?)`
    )
    .run(importanceScore)
  return result.lastInsertRowid as number
}

function insertOldMessage(db: Database.Database, daysAgo: number): void {
  // Need a conversation first
  const convResult = db.prepare(`INSERT INTO conversations DEFAULT VALUES`).run()
  const convId = convResult.lastInsertRowid as number

  db.prepare(
    `INSERT INTO messages (conversation_id, role, content, created_at)
     VALUES (?, 'user', 'old message', datetime('now', '-${daysAgo} days'))`
  ).run(convId)
}

function insertOldSession(db: Database.Database, daysAgo: number): void {
  db.prepare(
    `INSERT INTO activity_sessions (app_name, category, started_at)
     VALUES ('Chrome', 'BROWSING', datetime('now', '-${daysAgo} days'))`
  ).run()
}

let db: Database.Database

beforeEach(() => {
  db = openTestDb()
  __setTestDb(db)
})

afterEach(() => {
  db.close()
})

describe('checkChunkCap', () => {
  it('does nothing when chunk count is below 1800', () => {
    for (let i = 0; i < 100; i++) insertChunk(db)
    checkChunkCap()
    const count = (db.prepare('SELECT COUNT(*) AS n FROM memory_chunks').get() as { n: number }).n
    expect(count).toBe(100)
  })

  it('prunes to 1500 when chunk count reaches 1800', () => {
    for (let i = 0; i < 1800; i++) insertChunk(db, 0.5)
    checkChunkCap()
    const count = (db.prepare('SELECT COUNT(*) AS n FROM memory_chunks').get() as { n: number }).n
    expect(count).toBe(1500)
  })

  it('prunes the lowest importance_score chunks first', () => {
    // Insert 1800 chunks: 900 with low score, 900 with high score
    for (let i = 0; i < 900; i++) insertChunk(db, 0.1) // candidates for pruning
    for (let i = 0; i < 900; i++) insertChunk(db, 0.9) // should always be kept

    checkChunkCap()

    // After pruning to 1500: 300 low-importance chunks were deleted, 600 remain
    const lowCount = (
      db.prepare('SELECT COUNT(*) AS n FROM memory_chunks WHERE importance_score < 0.5').get() as { n: number }
    ).n
    const highCount = (
      db.prepare('SELECT COUNT(*) AS n FROM memory_chunks WHERE importance_score >= 0.5').get() as { n: number }
    ).n
    expect(highCount).toBe(900) // all high-importance chunks preserved
    expect(lowCount).toBe(600)  // 300 of 900 low-importance pruned, 600 remain
  })

  it('does not prune when count is exactly 1799', () => {
    for (let i = 0; i < 1799; i++) insertChunk(db)
    checkChunkCap()
    const count = (db.prepare('SELECT COUNT(*) AS n FROM memory_chunks').get() as { n: number }).n
    expect(count).toBe(1799)
  })
})

describe('purgeOldMessages', () => {
  it('deletes messages older than 90 days', () => {
    insertOldMessage(db, 91)
    insertOldMessage(db, 95)
    purgeOldMessages()
    const count = (db.prepare('SELECT COUNT(*) AS n FROM messages').get() as { n: number }).n
    expect(count).toBe(0)
  })

  it('keeps messages newer than 90 days', () => {
    insertOldMessage(db, 89)
    insertOldMessage(db, 10)
    purgeOldMessages()
    const count = (db.prepare('SELECT COUNT(*) AS n FROM messages').get() as { n: number }).n
    expect(count).toBe(2)
  })

  it('does nothing when there are no old messages', () => {
    expect(() => purgeOldMessages()).not.toThrow()
  })
})

describe('purgeOldSessions', () => {
  it('deletes activity sessions older than 30 days', () => {
    insertOldSession(db, 31)
    insertOldSession(db, 60)
    purgeOldSessions()
    const count = (db.prepare('SELECT COUNT(*) AS n FROM activity_sessions').get() as { n: number }).n
    expect(count).toBe(0)
  })

  it('keeps sessions newer than 30 days', () => {
    insertOldSession(db, 29)
    insertOldSession(db, 5)
    purgeOldSessions()
    const count = (db.prepare('SELECT COUNT(*) AS n FROM activity_sessions').get() as { n: number }).n
    expect(count).toBe(2)
  })
})

describe('scheduleWeeklyRebuild', () => {
  it('schedules a cron job without throwing', () => {
    expect(() => scheduleWeeklyRebuild()).not.toThrow()
  })
})

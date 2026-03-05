/**
 * Phase 1 — DB Layer Unit Tests
 *
 * Tests:
 *  - Schema creation runs without errors on an in-memory SQLite database
 *  - sqlite-vec extension loads (or gracefully fails with vecAvailable = false)
 *  - FTS5 virtual table is created
 *  - All expected tables exist after migrations
 *  - Companion core memory row is seeded
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../src/main/db/migrations'

function openTestDb(loadVec = true): { db: Database.Database; vecAvailable: boolean } {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  let vecAvailable = false
  if (loadVec) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sqliteVec = require('sqlite-vec')
      sqliteVec.load(db)
      vecAvailable = true
    } catch {
      vecAvailable = false
    }
  }

  return { db, vecAvailable }
}

const EXPECTED_TABLES = [
  'user_profile',
  'journal_entries',
  'memory_chunks',
  'conversations',
  'messages',
  'mood_logs',
  'activity_sessions',
  'companion_core_memory',
  'ccm_proposals',
  'agent_events',
  'llm_calls',
  'retrieval_logs',
  'schema_version',
  'memory_chunks_fts'
]

describe('Database migrations', () => {
  let db: Database.Database
  let vecAvailable: boolean

  beforeEach(() => {
    const result = openTestDb()
    db = result.db
    vecAvailable = result.vecAvailable
    runMigrations(db, vecAvailable)
  })

  afterEach(() => {
    db.close()
  })

  it('creates all expected tables', () => {
    const rows = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all() as { name: string }[]
    const tableNames = rows.map(r => r.name)

    for (const table of EXPECTED_TABLES) {
      expect(tableNames, `Table "${table}" should exist`).toContain(table)
    }
  })

  it('creates memory_vec virtual table when sqlite-vec is available', () => {
    const rows = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
      .all() as { name: string }[]
    const tableNames = rows.map(r => r.name)

    if (vecAvailable) {
      expect(tableNames).toContain('memory_vec')
    } else {
      expect(tableNames).not.toContain('memory_vec')
    }
  })

  it('seeds companion_core_memory with a single row', () => {
    const row = db
      .prepare('SELECT id FROM companion_core_memory WHERE id = 1')
      .get() as { id: number } | undefined
    expect(row).toBeDefined()
    expect(row!.id).toBe(1)
  })

  it('seeds user_profile with a single row', () => {
    const row = db
      .prepare('SELECT id FROM user_profile WHERE id = 1')
      .get() as { id: number } | undefined
    expect(row).toBeDefined()
    expect(row!.id).toBe(1)
  })

  it('records schema version 1', () => {
    const row = db
      .prepare('SELECT MAX(version) as version FROM schema_version')
      .get() as { version: number }
    expect(row.version).toBe(1)
  })

  it('is idempotent — running migrations twice does not throw', () => {
    expect(() => runMigrations(db, vecAvailable)).not.toThrow()
  })

  it('can insert and retrieve a journal entry', () => {
    db.prepare(`
      INSERT INTO journal_entries (mode, content)
      VALUES ('freeform', 'Test journal entry content')
    `).run()

    const row = db
      .prepare('SELECT content FROM journal_entries ORDER BY id DESC LIMIT 1')
      .get() as { content: string }
    expect(row.content).toBe('Test journal entry content')
  })

  it('can insert a mood log with valid normalised_score', () => {
    db.prepare(`
      INSERT INTO mood_logs (source, raw_value, normalised_score)
      VALUES ('emoji_vibe', 'good', 0.75)
    `).run()

    const row = db
      .prepare('SELECT normalised_score FROM mood_logs LIMIT 1')
      .get() as { normalised_score: number }
    expect(row.normalised_score).toBe(0.75)
  })

  it('enforces mood_logs normalised_score CHECK constraint', () => {
    expect(() => {
      db.prepare(`
        INSERT INTO mood_logs (source, raw_value, normalised_score)
        VALUES ('emoji_vibe', 'invalid', 1.5)
      `).run()
    }).toThrow()
  })
})

describe('Database without sqlite-vec', () => {
  it('runs migrations successfully without vec extension', () => {
    const { db } = openTestDb(false)
    expect(() => runMigrations(db, false)).not.toThrow()

    const rows = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
      .all() as { name: string }[]
    const tableNames = rows.map(r => r.name)
    expect(tableNames).not.toContain('memory_vec')

    db.close()
  })
})

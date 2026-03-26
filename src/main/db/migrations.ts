import type Database from 'better-sqlite3'
import {
  CREATE_TABLES,
  CREATE_INDEXES,
  CREATE_FTS5,
  CREATE_VEC_TABLE,
  CREATE_SCHEMA_VERSION
} from './schema'

const CURRENT_VERSION = 3

export function runMigrations(db: Database.Database, vecAvailable: boolean): void {
  db.exec(CREATE_SCHEMA_VERSION)

  const row = db.prepare('SELECT MAX(version) as version FROM schema_version').get() as
    | { version: number | null }
    | undefined
  const currentVersion = row?.version ?? 0

  if (currentVersion >= CURRENT_VERSION) {
    return
  }

  console.log(`[DB] Running migration from v${currentVersion} to v${CURRENT_VERSION}`)

  db.transaction(() => {
    // v0 → v1: initial schema
    if (currentVersion < 1) {
      db.exec(CREATE_TABLES)
      db.exec(CREATE_INDEXES)
      db.exec(CREATE_FTS5)

      if (vecAvailable) {
        db.exec(CREATE_VEC_TABLE)
        console.log('[DB] sqlite-vec virtual table created')
      } else {
        console.warn('[DB] sqlite-vec not available — skipping memory_vec table')
      }

      // Seed companion_core_memory with a single empty row
      db.prepare(`
        INSERT OR IGNORE INTO companion_core_memory (id) VALUES (1)
      `).run()

      // Seed user_profile with a single row
      db.prepare(`
        INSERT OR IGNORE INTO user_profile (id) VALUES (1)
      `).run()

      db.prepare('INSERT INTO schema_version (version) VALUES (1)').run()
    }

    // v1 → v2: add alarms table (for users who have v1 but table was misplaced in schema)
    if (currentVersion < 2) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS alarms (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          type           TEXT NOT NULL CHECK(type IN ('alarm','timer')),
          trigger_at     TEXT NOT NULL,
          message        TEXT,
          fired_at       TEXT,
          dismissed_at   TEXT,
          created_at     TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_alarms_trigger ON alarms(trigger_at) WHERE fired_at IS NULL AND dismissed_at IS NULL;
      `)

      db.prepare('INSERT INTO schema_version (version) VALUES (2)').run()
    }

    // v2 → v3: add todos table for productivity features
    if (currentVersion < 3) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS todos (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          content        TEXT NOT NULL,
          status         TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed')),
          priority       INTEGER NOT NULL DEFAULT 0 CHECK(priority BETWEEN 0 AND 2),
          due_date       TEXT,
          ai_suggested   INTEGER NOT NULL DEFAULT 0,
          created_at     TEXT NOT NULL DEFAULT (datetime('now')),
          completed_at   TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status, created_at);
      `)

      db.prepare('INSERT INTO schema_version (version) VALUES (3)').run()
    }
  })()

  console.log('[DB] Migration complete')
}

import type Database from 'better-sqlite3'
import {
  CREATE_TABLES,
  CREATE_INDEXES,
  CREATE_FTS5,
  CREATE_VEC_TABLE,
  CREATE_SCHEMA_VERSION
} from './schema'

const CURRENT_VERSION = 1

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
  })()

  console.log('[DB] Migration complete')
}

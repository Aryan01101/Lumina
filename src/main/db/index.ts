import { join } from 'path'
import { app } from 'electron'
import Database from 'better-sqlite3'
import { runMigrations } from './migrations'

let _db: Database.Database | null = null
export let vecAvailable = false

export function getDb(): Database.Database {
  if (!_db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return _db
}

export function initDatabase(): Database.Database {
  if (_db) return _db

  const dbPath = join(app.getPath('userData'), 'lumina.db')
  console.log(`[DB] Opening database at: ${dbPath}`)

  _db = new Database(dbPath)

  // Enable WAL mode for better concurrent read performance
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
  _db.pragma('busy_timeout = 5000')

  // Try to load sqlite-vec extension
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sqliteVec = require('sqlite-vec')
    sqliteVec.load(_db)
    vecAvailable = true
    console.log('[DB] sqlite-vec loaded successfully')
  } catch (err) {
    vecAvailable = false
    console.warn('[DB] sqlite-vec not available — falling back to keyword-only retrieval:', err)
  }

  runMigrations(_db, vecAvailable)

  console.log('[DB] Database ready')
  return _db
}

export function closeDatabase(): void {
  if (_db) {
    _db.close()
    _db = null
    console.log('[DB] Database closed')
  }
}

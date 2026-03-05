import { createHash } from 'crypto'
import { getDb } from '../db'
import type { ActivityState } from './index'

export interface ActiveSession {
  id: number
  appName: string
  category: ActivityState
  startedAt: Date
}

let _currentSession: ActiveSession | null = null

export function getCurrentSession(): ActiveSession | null {
  return _currentSession
}

/**
 * Returns how long the current session has been running, in minutes.
 * Returns 0 if no session is active.
 */
export function getCurrentSessionMinutes(): number {
  if (!_currentSession) return 0
  return (Date.now() - _currentSession.startedAt.getTime()) / 60_000
}

/**
 * Hash a window title with SHA-256 for privacy.
 * The raw title is never stored.
 */
export function hashTitle(title: string): string {
  return createHash('sha256').update(title).digest('hex')
}

/**
 * Open a new activity session in the database.
 */
export function openSession(
  appName: string,
  category: ActivityState,
  windowTitle: string
): ActiveSession {
  const db = getDb()
  const titleHash = windowTitle ? hashTitle(windowTitle) : null

  const result = db.prepare(`
    INSERT INTO activity_sessions (app_name, category, window_title_hash, started_at)
    VALUES (?, ?, ?, datetime('now'))
  `).run(appName, category, titleHash)

  _currentSession = {
    id: result.lastInsertRowid as number,
    appName,
    category,
    startedAt: new Date()
  }

  return _currentSession
}

/**
 * Close the current session: write ended_at and computed duration_seconds.
 */
export function closeSession(): void {
  if (!_currentSession) return

  const db = getDb()
  const endedAt = new Date()
  const durationSeconds = Math.round(
    (endedAt.getTime() - _currentSession.startedAt.getTime()) / 1000
  )

  db.prepare(`
    UPDATE activity_sessions
    SET ended_at = datetime('now'), duration_seconds = ?
    WHERE id = ?
  `).run(durationSeconds, _currentSession.id)

  _currentSession = null
}

/**
 * Purge activity sessions older than 30 days (PRD F-11 retention policy).
 */
export function purgeOldSessions(): void {
  const db = getDb()
  const deleted = db.prepare(`
    DELETE FROM activity_sessions
    WHERE started_at < datetime('now', '-30 days')
  `).run()

  if (deleted.changes > 0) {
    console.log(`[Activity] Purged ${deleted.changes} old activity sessions`)
  }
}

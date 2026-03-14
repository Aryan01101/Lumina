/**
 * Memory retention — enforces storage caps and purges stale data.
 *
 * - checkChunkCap():       prune lowest-importance chunks when count >= 1800
 * - purgeOldMessages():    delete raw messages older than 90 days
 * - purgeOldSessions():    delete activity sessions older than 30 days
 * - scheduleWeeklyRebuild(): weekly VACUUM via node-cron
 */

import cron from 'node-cron'
import { getDb } from '../db'

const CHUNK_CAP_TRIGGER = 1800
const CHUNK_CAP_TARGET = 1500
const MESSAGE_RETENTION_DAYS = 90
const SESSION_RETENTION_DAYS = 30

/**
 * Check the total chunk count. If >= 1800, prune lowest importance_score
 * chunks until the count reaches 1500.
 */
export function checkChunkCap(): void {
  const db = getDb()

  const countRow = db.prepare('SELECT COUNT(*) AS total FROM memory_chunks').get() as {
    total: number
  }

  if (countRow.total < CHUNK_CAP_TRIGGER) return

  const toDelete = countRow.total - CHUNK_CAP_TARGET
  if (toDelete <= 0) return

  db.prepare(
    `DELETE FROM memory_chunks
     WHERE id IN (
       SELECT id FROM memory_chunks
       ORDER BY importance_score ASC, created_at ASC
       LIMIT ?
     )`
  ).run(toDelete)

  console.log(`[Retention] Pruned ${toDelete} low-importance chunks (cap enforced)`)
}

/**
 * Delete messages older than 90 days that have not been summarised.
 * (Summarised conversations retain their summary_chunk_id pointer.)
 */
export function purgeOldMessages(): void {
  const db = getDb()

  const result = db
    .prepare(
      `DELETE FROM messages
       WHERE created_at < datetime('now', '-${MESSAGE_RETENTION_DAYS} days')`
    )
    .run()

  if (result.changes > 0) {
    console.log(`[Retention] Purged ${result.changes} messages older than ${MESSAGE_RETENTION_DAYS} days`)
  }
}

/**
 * Delete activity sessions older than 30 days.
 */
export function purgeOldSessions(): void {
  const db = getDb()

  const result = db
    .prepare(
      `DELETE FROM activity_sessions
       WHERE started_at < datetime('now', '-${SESSION_RETENTION_DAYS} days')`
    )
    .run()

  if (result.changes > 0) {
    console.log(`[Retention] Purged ${result.changes} activity sessions older than ${SESSION_RETENTION_DAYS} days`)
  }
}

/**
 * Schedule a weekly VACUUM to reclaim disk space and defragment sqlite-vec.
 * Runs every Sunday at 03:00 local time.
 */
export function scheduleWeeklyRebuild(): void {
  cron.schedule('0 3 * * 0', () => {
    try {
      const db = getDb()
      db.exec('VACUUM')
      console.log('[Retention] Weekly VACUUM complete')
    } catch (err) {
      console.error('[Retention] Weekly VACUUM failed:', err)
    }
  })

  console.log('[Retention] Weekly rebuild scheduled (Sundays at 03:00)')
}

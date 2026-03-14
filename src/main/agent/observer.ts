/**
 * Agent Observer — Phase 7
 *
 * Pure DB read functions for the Observe node (Node 2).
 * No LLM calls, no side effects beyond SELECT queries.
 */

import type Database from 'better-sqlite3'

// ─── Mood trend ───────────────────────────────────────────────────────────────

/**
 * Computes average normalised_score and trend direction for mood logs
 * within the past `days` days.
 */
export function getMoodTrend(
  db: Database.Database,
  days: number
): { avg: number | null; direction: 'up' | 'down' | 'flat' | null } {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const rows = db.prepare(`
    SELECT normalised_score
    FROM mood_logs
    WHERE created_at >= ?
    ORDER BY created_at ASC
  `).all(cutoff) as Array<{ normalised_score: number }>

  if (rows.length === 0) return { avg: null, direction: null }

  const scores = rows.map(r => r.normalised_score)
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length

  let direction: 'up' | 'down' | 'flat' = 'flat'
  if (scores.length >= 2) {
    const first = scores.slice(0, Math.ceil(scores.length / 2))
    const last  = scores.slice(Math.floor(scores.length / 2))
    const firstAvg = first.reduce((a, b) => a + b, 0) / first.length
    const lastAvg  = last.reduce((a, b) => a + b, 0) / last.length
    const delta = lastAvg - firstAvg
    if (delta > 0.05)       direction = 'up'
    else if (delta < -0.05) direction = 'down'
  }

  return { avg, direction }
}

// ─── Recency reads ────────────────────────────────────────────────────────────

/**
 * Returns the ISO timestamp of the most recent journal entry, or null.
 */
export function getLastJournalAt(db: Database.Database): string | null {
  const row = db.prepare('SELECT created_at FROM journal_entries ORDER BY id DESC LIMIT 1')
    .get() as { created_at: string } | undefined
  return row?.created_at ?? null
}

/**
 * Returns the ISO timestamp of the most recent conversation message, or null.
 */
export function getLastConversationAt(db: Database.Database): string | null {
  const row = db.prepare('SELECT created_at FROM messages ORDER BY id DESC LIMIT 1')
    .get() as { created_at: string } | undefined
  return row?.created_at ?? null
}

/**
 * Returns the created_at of the most recent agent_event that was a
 * non-SILENCE action (i.e., an actual initiation), or null.
 */
export function getLastInitiationAt(db: Database.Database): string | null {
  const row = db.prepare(`
    SELECT created_at FROM agent_events
    WHERE action_type != 'SILENCE'
    ORDER BY id DESC LIMIT 1
  `).get() as { created_at: string } | undefined
  return row?.created_at ?? null
}

/**
 * Returns the count of consecutive dismissed agent events from the most recent.
 * Stops counting when it hits an engaged or no_response event.
 * Returns 0 if no dismissed events at the top of the history.
 */
export function getConsecutiveDismissals(db: Database.Database): number {
  const rows = db.prepare(`
    SELECT user_response FROM agent_events
    WHERE user_response IS NOT NULL
    ORDER BY id DESC
    LIMIT 20
  `).all() as Array<{ user_response: string }>

  let count = 0
  for (const row of rows) {
    if (row.user_response === 'dismissed') {
      count++
    } else {
      break
    }
  }
  return count
}

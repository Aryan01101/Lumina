/**
 * Alarms & Timers Tool
 *
 * Manages alarms and timers with Electron notifications.
 * - Alarms: Fire at specific time (e.g., "3pm", "tomorrow at 9am")
 * - Timers: Fire after duration (e.g., "5 minutes", "1 hour")
 */

import type Database from 'better-sqlite3'
import { Notification } from 'electron'
import { parseRelativeTime, parseAbsoluteTime } from '../utils/timeParser'

export interface AlarmData {
  id: number
  type: 'alarm' | 'timer'
  triggerAt: string
  message: string | null
  firedAt: string | null
  dismissedAt: string | null
  createdAt: string
}

const activeTimers = new Map<number, NodeJS.Timeout>()

/**
 * Creates a new alarm or timer in the database.
 */
export function createAlarm(
  db: Database.Database,
  type: 'alarm' | 'timer',
  triggerAt: Date,
  message?: string
): number {
  const result = db.prepare(`
    INSERT INTO alarms (type, trigger_at, message)
    VALUES (?, ?, ?)
  `).run(type, triggerAt.toISOString(), message || null)

  const alarmId = result.lastInsertRowid as number

  // Schedule notification
  scheduleNotification(db, alarmId, triggerAt, message || 'Reminder!')

  return alarmId
}

/**
 * Schedules an Electron notification to fire at the specified time.
 */
function scheduleNotification(
  db: Database.Database,
  alarmId: number,
  triggerAt: Date,
  message: string
): void {
  const now = new Date()
  const delay = triggerAt.getTime() - now.getTime()

  if (delay <= 0) {
    // Already passed - fire immediately
    fireNotification(db, alarmId, message)
    return
  }

  // Schedule for future
  const timer = setTimeout(() => {
    fireNotification(db, alarmId, message)
    activeTimers.delete(alarmId)
  }, delay)

  activeTimers.set(alarmId, timer)
}

/**
 * Fires an Electron notification and marks alarm as fired.
 */
function fireNotification(db: Database.Database, alarmId: number, message: string): void {
  // Show notification
  const notification = new Notification({
    title: 'Lumina Reminder',
    body: message,
    silent: false
  })

  notification.show()

  // Mark as fired
  db.prepare(`
    UPDATE alarms SET fired_at = datetime('now')
    WHERE id = ?
  `).run(alarmId)

  console.log(`[Alarm] Fired alarm ${alarmId}: ${message}`)
}

/**
 * Loads all pending alarms from database and schedules them.
 * Called on app startup.
 */
export function loadPendingAlarms(db: Database.Database): void {
  const pending = db.prepare(`
    SELECT id, type, trigger_at, message
    FROM alarms
    WHERE fired_at IS NULL AND dismissed_at IS NULL
    ORDER BY trigger_at ASC
  `).all() as Array<{
    id: number
    type: string
    trigger_at: string
    message: string | null
  }>

  for (const alarm of pending) {
    const triggerAt = new Date(alarm.trigger_at)
    scheduleNotification(db, alarm.id, triggerAt, alarm.message || 'Reminder!')
  }

  console.log(`[Alarm] Loaded ${pending.length} pending alarms`)
}

/**
 * Cancels an active alarm/timer.
 */
export function dismissAlarm(db: Database.Database, alarmId: number): void {
  // Cancel timer if active
  const timer = activeTimers.get(alarmId)
  if (timer) {
    clearTimeout(timer)
    activeTimers.delete(alarmId)
  }

  // Mark as dismissed
  db.prepare(`
    UPDATE alarms SET dismissed_at = datetime('now')
    WHERE id = ?
  `).run(alarmId)
}

/**
 * Detects if a user message is requesting an alarm or timer.
 * Returns parsed alarm data or null.
 */
export function detectAlarm(message: string): {
  type: 'alarm' | 'timer'
  triggerAt: Date
  message?: string
} | null {
  const msg = message.toLowerCase().trim()

  // Timer patterns: "remind me in X minutes/hours"
  const timerPatterns = [
    /(?:remind me|set (?:a )?timer|timer) (?:in|for) (.+?)(?:\s+to\s+(.+))?$/i,
    /(?:in|after) (\d+\s*(?:minute|min|hour|hr|second|sec)s?)(?:\s+to\s+(.+))?$/i
  ]

  for (const pattern of timerPatterns) {
    const match = msg.match(pattern)
    if (match) {
      const duration = match[1]
      const timerMessage = match[2] || 'Timer finished!'

      const triggerAt = parseRelativeTime(duration)
      if (triggerAt) {
        return { type: 'timer', triggerAt, message: timerMessage }
      }
    }
  }

  // Alarm patterns: "remind me at 3pm", "set alarm for tomorrow at 9am"
  const alarmPatterns = [
    /(?:remind me|set (?:an? )?alarm|alarm) (?:at|for) (.+?)(?:\s+to\s+(.+))?$/i,
    /at (\d{1,2}(?::\d{2})?\s*(?:am|pm))(?:\s+to\s+(.+))?$/i
  ]

  for (const pattern of alarmPatterns) {
    const match = msg.match(pattern)
    if (match) {
      const timeStr = match[1]
      const alarmMessage = match[2] || 'Alarm!'

      const triggerAt = parseAbsoluteTime(timeStr)
      if (triggerAt) {
        return { type: 'alarm', triggerAt, message: alarmMessage }
      }
    }
  }

  return null
}

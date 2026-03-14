/**
 * Agent Scheduler — Phase 7
 *
 * Owns the cron job (every 30 min) and the transition trigger
 * (90s delay after DEEP_WORK/STUDY → BROWSING/IDLE).
 */

import cron from 'node-cron'
import type { BrowserWindow } from 'electron'
import type { ActivityState } from '../activity'
import { runAgentCycle } from './index'

const TRANSITION_DELAY_MS = 90_000

let _job: ReturnType<typeof cron.schedule> | null = null
let _transitionTimer: ReturnType<typeof setTimeout> | null = null

const WORK_STATES   = new Set<ActivityState>(['DEEP_WORK', 'STUDY'])
const PASSIVE_STATES = new Set<ActivityState>(['BROWSING', 'IDLE'])

export function startScheduler(mainWindow: BrowserWindow): void {
  if (_job) return

  _job = cron.schedule('0,30 * * * *', () => {
    runAgentCycle('scheduled', mainWindow).catch(err =>
      console.error('[Agent] Scheduled cycle error:', err)
    )
  })

  console.log('[Agent] Scheduler started (every 30 min)')
}

export function stopScheduler(): void {
  if (_job) {
    _job.stop()
    _job = null
  }
  if (_transitionTimer) {
    clearTimeout(_transitionTimer)
    _transitionTimer = null
  }
  console.log('[Agent] Scheduler stopped')
}

/**
 * Called when an activity state transition is detected.
 * Triggers a cycle with 90s delay if transitioning out of focused work.
 */
export function onActivityTransition(
  from: ActivityState,
  to: ActivityState,
  mainWindow: BrowserWindow
): void {
  if (!WORK_STATES.has(from) || !PASSIVE_STATES.has(to)) return

  // Cancel any existing pending transition
  if (_transitionTimer) {
    clearTimeout(_transitionTimer)
    _transitionTimer = null
  }

  console.log(`[Agent] Transition detected: ${from} → ${to}. Triggering cycle in 90s.`)

  _transitionTimer = setTimeout(() => {
    _transitionTimer = null
    runAgentCycle('transition', mainWindow).catch(err =>
      console.error('[Agent] Transition cycle error:', err)
    )
  }, TRANSITION_DELAY_MS)
}

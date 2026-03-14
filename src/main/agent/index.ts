/**
 * LangGraph Agent Loop — Phase 7
 *
 * 6-node StateGraph:
 *   1. Gate Check  — evaluates all 5 interruption gates (no LLM)
 *   2. Observe     — reads last_journal, last_conversation, mood_logs, activity state
 *   3. Analyse     — embeds observation → hybrid retrieval → LLM analysis
 *   4. Decide      — LLM selects CELEBRATE | CHECKIN | NUDGE | SILENCE
 *   5. Act         — if not SILENCE, generate grounded message → push to renderer
 *   6. Log         — write agent_event to SQLite
 *
 * Scheduled: node-cron every 30 minutes + triggered on activity state transitions.
 * Gate 1 is absolute — DEEP_WORK / STUDY / GAMING / VIDEO_CALL always HOLD.
 */

import { randomUUID } from 'crypto'
import type { BrowserWindow } from 'electron'
import { getDb } from '../db'
import { getCurrentActivity } from '../activity'
import { runAgentGraph } from './graph'
import { startScheduler, stopScheduler } from './scheduler'

export type ActivityState = 'DEEP_WORK' | 'STUDY' | 'GAMING' | 'VIDEO_CALL' |
  'PASSIVE_CONTENT' | 'BROWSING' | 'IDLE' | 'LUMINA'

export type ActionType = 'CELEBRATE' | 'CHECKIN' | 'NUDGE' | 'SILENCE'

export type AgentTrigger = 'scheduled' | 'transition'

export interface AgentState {
  trigger:               AgentTrigger
  activityState:         ActivityState
  isTransition:          boolean
  transitionContext:     string
  timeOfDay:             string
  lastInitiationAt:      string | null
  consecutiveDismissals: number
  pausedUntil:           string | null
  lastJournalAt:         string | null
  lastConversationAt:    string | null
  moodTrend7d:           number | null
  moodTrendDirection:    'up' | 'down' | 'flat' | null
  gateResults:           Record<string, 'pass' | 'hold'>
  retrievedMemories:     string[]
  analysis:              string
  actionType:            ActionType
  message:               string | null
  runId:                 string
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function startAgentScheduler(mainWindow: BrowserWindow): void {
  startScheduler(mainWindow)
}

export function stopAgentScheduler(): void {
  stopScheduler()
}

/**
 * Runs one agent cycle. Accepts optional mainWindow and db for testability
 * (production code uses getDb() and the stored window reference).
 */
export async function runAgentCycle(
  trigger: AgentTrigger,
  mainWindow?: BrowserWindow,
  db?: ReturnType<typeof getDb>,
  nowIso?: string
): Promise<AgentState> {
  const resolvedDb  = db  ?? getDb()
  const activity    = getCurrentActivity()
  const now         = nowIso ?? new Date().toISOString()

  const initialState: AgentState = {
    trigger,
    activityState:         activity.state as ActivityState,
    isTransition:          trigger === 'transition',
    transitionContext:     trigger === 'transition' ? `from ${activity.state}` : '',
    timeOfDay:             now,
    lastInitiationAt:      null,
    consecutiveDismissals: 0,
    pausedUntil:           null,
    lastJournalAt:         null,
    lastConversationAt:    null,
    moodTrend7d:           null,
    moodTrendDirection:    null,
    gateResults:           {},
    retrievedMemories:     [],
    analysis:              '',
    actionType:            'SILENCE',
    message:               null,
    runId:                 randomUUID()
  }

  // Provide a no-op window if none supplied (test/offline scenarios)
  const win = mainWindow ?? {
    webContents: { send: () => {} },
    isDestroyed: () => true
  } as unknown as BrowserWindow

  return runAgentGraph(initialState, win, resolvedDb)
}

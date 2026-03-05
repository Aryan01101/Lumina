/**
 * LangGraph Agent Loop — Phase 7
 *
 * 6-node StateGraph:
 *   1. Gate Check  — evaluates all 5 interruption gates (no LLM)
 *   2. Observe     — reads last_journal, last_conversation, mood_logs, activity state
 *   3. Analyse     — embeds observation → hybrid retrieval → LLM analysis
 *   4. Decide      — LLM selects CELEBRATE | CHECKIN | NUDGE | SILENCE
 *   5. Act         — if not SILENCE, generate grounded message → push to renderer
 *   6. Log         — write agent_event to SQLite, emit Langfuse if enabled
 *
 * Scheduled: node-cron every 30 minutes + triggered on activity state transitions.
 * Gate 1 is absolute — DEEP_WORK / STUDY / GAMING / VIDEO_CALL always HOLD.
 *
 * All logic is stubbed until Phase 7.
 */

export type ActionType = 'CELEBRATE' | 'CHECKIN' | 'NUDGE' | 'SILENCE'

export interface AgentState {
  activityState: string
  lastJournalAt: string | null
  lastConversationAt: string | null
  moodTrend7d: number | null
  moodTrendDirection: 'up' | 'down' | 'flat' | null
  timeOfDay: string
  gateResults: Record<string, 'pass' | 'hold'>
  retrievedMemories: unknown[]
  analysis: string
  actionType: ActionType
  message: string | null
}

// Phase 7: start the agent scheduler
export function startAgentScheduler(_mainWindow: Electron.BrowserWindow): void {
  console.log('[Agent] Scheduler placeholder — Phase 7 implementation pending')
}

export function stopAgentScheduler(): void {
  // Phase 7
}

// Phase 7: run a single agent loop cycle (exported for testing)
export async function runAgentCycle(_trigger: 'scheduled' | 'transition'): Promise<AgentState> {
  console.log('[Agent] Cycle placeholder — Phase 7 implementation pending')
  return {
    activityState: 'BROWSING',
    lastJournalAt: null,
    lastConversationAt: null,
    moodTrend7d: null,
    moodTrendDirection: null,
    timeOfDay: new Date().toISOString(),
    gateResults: {},
    retrievedMemories: [],
    analysis: '',
    actionType: 'SILENCE',
    message: null
  }
}

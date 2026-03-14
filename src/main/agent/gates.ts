/**
 * Interruption Gate Logic — Phase 7
 *
 * Five pure synchronous gates. All take explicit parameters — no DB,
 * no side effects. Evaluated in sequence; first HOLD stops evaluation.
 */

import type { ActivityState } from '../activity'

export interface GateParams {
  activityState:         ActivityState
  nowIso:                string
  lastInitiationAt:      string | null
  thresholdMinutes:      number          // 120 normally, 60 on transition
  consecutiveDismissals: number
  pausedUntil:           string | null
}

// ─── Individual gates ─────────────────────────────────────────────────────────

/**
 * Gate 1 — Activity state (ABSOLUTE).
 * DEEP_WORK / STUDY / GAMING / VIDEO_CALL / LUMINA → always hold.
 */
export function gate1ActivityState(state: ActivityState): 'pass' | 'hold' {
  const blocked = new Set<ActivityState>(['DEEP_WORK', 'STUDY', 'GAMING', 'VIDEO_CALL', 'LUMINA'])
  return blocked.has(state) ? 'hold' : 'pass'
}

/**
 * Gate 2 — Time of day (8:00am – 10:00pm local time).
 */
export function gate2TimeOfDay(nowIso: string): 'pass' | 'hold' {
  const h = new Date(nowIso).getHours()
  return h >= 8 && h < 22 ? 'pass' : 'hold'
}

/**
 * Gate 3 — Recency.
 * Last initiation must be ≥ thresholdMinutes ago (or never initiated).
 */
export function gate3Recency(
  lastInitiationAt: string | null,
  nowIso: string,
  thresholdMinutes: number
): 'pass' | 'hold' {
  if (!lastInitiationAt) return 'pass'
  const elapsedMs = new Date(nowIso).getTime() - new Date(lastInitiationAt).getTime()
  return elapsedMs >= thresholdMinutes * 60 * 1000 ? 'pass' : 'hold'
}

/**
 * Gate 4 — Priority dedup.
 * Phase 7: no message queue → always pass.
 */
export function gate4PriorityDedup(): 'pass' | 'hold' {
  return 'pass'
}

/**
 * Gate 5 — Engagement history.
 * 5+ consecutive dismissals → hold.
 * pausedUntil in the future → hold.
 */
export function gate5EngagementHistory(
  consecutiveDismissals: number,
  pausedUntil: string | null,
  nowIso: string
): 'pass' | 'hold' {
  if (pausedUntil) {
    // An explicit pause was set — if still active, hold
    if (new Date(nowIso) < new Date(pausedUntil)) return 'hold'
    // Pause has expired → fresh start, regardless of dismissal count
    return 'pass'
  }
  // No pause set: block on 5+ consecutive dismissals
  if (consecutiveDismissals >= 5) return 'hold'
  return 'pass'
}

// ─── Composite evaluator ──────────────────────────────────────────────────────

/**
 * Evaluates all 5 gates in sequence.
 * Stops on first 'hold' — subsequent gates are not added to results.
 */
export function evaluateAllGates(params: GateParams): {
  results: Record<string, 'pass' | 'hold'>
  passed:  boolean
} {
  const results: Record<string, 'pass' | 'hold'> = {}

  const g1 = gate1ActivityState(params.activityState)
  results.gate1 = g1
  if (g1 === 'hold') return { results, passed: false }

  const g2 = gate2TimeOfDay(params.nowIso)
  results.gate2 = g2
  if (g2 === 'hold') return { results, passed: false }

  const g3 = gate3Recency(params.lastInitiationAt, params.nowIso, params.thresholdMinutes)
  results.gate3 = g3
  if (g3 === 'hold') return { results, passed: false }

  const g4 = gate4PriorityDedup()
  results.gate4 = g4
  if (g4 === 'hold') return { results, passed: false }

  const g5 = gate5EngagementHistory(params.consecutiveDismissals, params.pausedUntil, params.nowIso)
  results.gate5 = g5
  if (g5 === 'hold') return { results, passed: false }

  return { results, passed: true }
}

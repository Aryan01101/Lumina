/**
 * Agent Gate Tests — Phase 7
 *
 * Pure synchronous gate logic — no mocks needed.
 */
import { describe, it, expect } from 'vitest'
import {
  gate1ActivityState,
  gate2TimeOfDay,
  gate3Recency,
  gate4PriorityDedup,
  gate5EngagementHistory,
  evaluateAllGates
} from '../../src/main/agent/gates'
import type { GateParams } from '../../src/main/agent/gates'
import type { ActivityState } from '../../src/main/activity'

// ─── gate1ActivityState ───────────────────────────────────────────────────────

describe('gate1ActivityState', () => {
  it('IDLE → pass', () => {
    expect(gate1ActivityState('IDLE')).toBe('pass')
  })

  it('BROWSING → pass', () => {
    expect(gate1ActivityState('BROWSING')).toBe('pass')
  })

  it('PASSIVE_CONTENT → pass', () => {
    expect(gate1ActivityState('PASSIVE_CONTENT')).toBe('pass')
  })

  it('DEEP_WORK → hold', () => {
    expect(gate1ActivityState('DEEP_WORK')).toBe('hold')
  })

  it('STUDY → hold', () => {
    expect(gate1ActivityState('STUDY')).toBe('hold')
  })

  it('GAMING → hold', () => {
    expect(gate1ActivityState('GAMING')).toBe('hold')
  })

  it('VIDEO_CALL → hold', () => {
    expect(gate1ActivityState('VIDEO_CALL')).toBe('hold')
  })

  it('LUMINA → hold', () => {
    expect(gate1ActivityState('LUMINA')).toBe('hold')
  })
})

// ─── gate2TimeOfDay ───────────────────────────────────────────────────────────

describe('gate2TimeOfDay', () => {
  it('9:00 → pass', () => {
    const now = new Date()
    now.setHours(9, 0, 0, 0)
    expect(gate2TimeOfDay(now.toISOString())).toBe('pass')
  })

  it('21:00 → pass', () => {
    const now = new Date()
    now.setHours(21, 0, 0, 0)
    expect(gate2TimeOfDay(now.toISOString())).toBe('pass')
  })

  it('07:59 → hold', () => {
    const now = new Date()
    now.setHours(7, 59, 0, 0)
    expect(gate2TimeOfDay(now.toISOString())).toBe('hold')
  })

  it('22:01 → hold', () => {
    const now = new Date()
    now.setHours(22, 1, 0, 0)
    expect(gate2TimeOfDay(now.toISOString())).toBe('hold')
  })
})

// ─── gate3Recency ─────────────────────────────────────────────────────────────

describe('gate3Recency', () => {
  it('lastInitiationAt null → pass (never initiated)', () => {
    expect(gate3Recency(null, new Date().toISOString(), 120)).toBe('pass')
  })

  it('last initiation 3 hours ago, threshold 120 min → pass', () => {
    const last = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    expect(gate3Recency(last, new Date().toISOString(), 120)).toBe('pass')
  })

  it('last initiation 30 min ago, threshold 120 min → hold', () => {
    const last = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    expect(gate3Recency(last, new Date().toISOString(), 120)).toBe('hold')
  })

  it('last initiation 65 min ago, threshold 60 min (transition) → pass', () => {
    const last = new Date(Date.now() - 65 * 60 * 1000).toISOString()
    expect(gate3Recency(last, new Date().toISOString(), 60)).toBe('pass')
  })
})

// ─── gate4PriorityDedup ───────────────────────────────────────────────────────

describe('gate4PriorityDedup', () => {
  it('always returns pass (Phase 7 placeholder — no message queue)', () => {
    expect(gate4PriorityDedup()).toBe('pass')
  })
})

// ─── gate5EngagementHistory ───────────────────────────────────────────────────

describe('gate5EngagementHistory', () => {
  const now = new Date().toISOString()

  it('0 dismissals, no pause → pass', () => {
    expect(gate5EngagementHistory(0, null, now)).toBe('pass')
  })

  it('2 dismissals, no pause → pass', () => {
    expect(gate5EngagementHistory(2, null, now)).toBe('pass')
  })

  it('4 dismissals, no pause → pass (threshold is 5)', () => {
    expect(gate5EngagementHistory(4, null, now)).toBe('pass')
  })

  it('5 dismissals, no pause → hold', () => {
    expect(gate5EngagementHistory(5, null, now)).toBe('hold')
  })

  it('6 dismissals, no pause → hold', () => {
    expect(gate5EngagementHistory(6, null, now)).toBe('hold')
  })

  it('5 dismissals, pausedUntil in past → pass (pause expired)', () => {
    const pastPause = new Date(Date.now() - 1000).toISOString()
    expect(gate5EngagementHistory(5, pastPause, now)).toBe('pass')
  })

  it('pausedUntil in future → hold', () => {
    const futurePause = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
    expect(gate5EngagementHistory(0, futurePause, now)).toBe('hold')
  })
})

// ─── evaluateAllGates ─────────────────────────────────────────────────────────

describe('evaluateAllGates', () => {
  const daytimeIso = (() => {
    const d = new Date()
    d.setHours(10, 0, 0, 0)
    return d.toISOString()
  })()

  const baseParams: GateParams = {
    activityState:         'IDLE',
    nowIso:                daytimeIso,
    lastInitiationAt:      null,
    thresholdMinutes:      120,
    consecutiveDismissals: 0,
    pausedUntil:           null
  }

  it('all 5 gates pass → { passed: true, results: all pass }', () => {
    const result = evaluateAllGates(baseParams)
    expect(result.passed).toBe(true)
    expect(result.results.gate1).toBe('pass')
    expect(result.results.gate2).toBe('pass')
    expect(result.results.gate3).toBe('pass')
    expect(result.results.gate4).toBe('pass')
    expect(result.results.gate5).toBe('pass')
  })

  it('gate1 fails (DEEP_WORK) → passed=false, gate1=hold', () => {
    const result = evaluateAllGates({ ...baseParams, activityState: 'DEEP_WORK' })
    expect(result.passed).toBe(false)
    expect(result.results.gate1).toBe('hold')
  })

  it('gate2 fails (night time) but gate1 passes → stopped at gate2', () => {
    const nightIso = (() => {
      const d = new Date()
      d.setHours(1, 0, 0, 0)
      return d.toISOString()
    })()
    const result = evaluateAllGates({ ...baseParams, nowIso: nightIso })
    expect(result.passed).toBe(false)
    expect(result.results.gate1).toBe('pass')
    expect(result.results.gate2).toBe('hold')
    // gate3 not evaluated
    expect(result.results.gate3).toBeUndefined()
  })

  it('gate5 fails (5 dismissals) → passed=false, gate5=hold', () => {
    const result = evaluateAllGates({ ...baseParams, consecutiveDismissals: 5 })
    expect(result.passed).toBe(false)
    expect(result.results.gate5).toBe('hold')
  })
})

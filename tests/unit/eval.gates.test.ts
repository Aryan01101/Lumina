/**
 * Eval Harness — Gate Scenarios — Phase 10
 *
 * Runs the 10 golden gate scenarios from tests/golden/gates-NN.json
 * against the real evaluateAllGates() function.
 *
 * The test runner:
 *   1. Loads each gates-*.json file
 *   2. Builds GateParams from the setup block
 *   3. Calls evaluateAllGates()
 *   4. Asserts gate results and overall pass/hold match expected
 *
 * "skip" in expected means the gate was not reached (earlier gate held)
 * and we assert the key is absent from the results object.
 *
 * "action_type": "INITIATE" in expected means any non-SILENCE action is valid
 * (the actual decision is LLM-determined, not tested here).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { evaluateAllGates } from '../../src/main/agent/gates'
import type { GateParams } from '../../src/main/agent/gates'

// ─── Types matching golden JSON schema ────────────────────────────────────────

interface GateScenarioSetup {
  activity_state:                string
  hour_of_day:                   number
  minutes_since_last_initiation: number
  consecutive_dismissals:        number
  paused_until:                  string | null
  trigger_type?:                 'scheduled' | 'transition'
}

interface GateScenarioExpected {
  gate_1:      'pass' | 'hold' | 'skip'
  gate_2?:     'pass' | 'hold' | 'skip'
  gate_3?:     'pass' | 'hold' | 'skip'
  gate_4?:     'pass' | 'hold' | 'skip'
  gate_5?:     'pass' | 'hold' | 'skip'
  overall:     'pass' | 'hold'
  action_type: 'SILENCE' | 'INITIATE'
}

interface GateScenario {
  id:          string
  category:    string
  description: string
  setup:       GateScenarioSetup
  expected:    GateScenarioExpected
}

// ─── Load all golden gate scenarios ──────────────────────────────────────────

const GOLDEN_DIR = join(__dirname, '../golden')

function loadGateScenarios(): GateScenario[] {
  return readdirSync(GOLDEN_DIR)
    .filter(f => f.startsWith('gates-') && f.endsWith('.json'))
    .sort()
    .map(f => JSON.parse(readFileSync(join(GOLDEN_DIR, f), 'utf8')) as GateScenario)
}

// ─── Build GateParams from scenario setup ────────────────────────────────────

function buildGateParams(setup: GateScenarioSetup): GateParams {
  // Build an ISO timestamp with the scenario's hour_of_day
  const now = new Date()
  now.setHours(setup.hour_of_day, 0, 0, 0)
  const nowIso = now.toISOString()

  // Compute lastInitiationAt relative to the same nowIso
  const lastInitiationAt = setup.minutes_since_last_initiation > 0
    ? new Date(now.getTime() - setup.minutes_since_last_initiation * 60 * 1000).toISOString()
    : null

  // Transition trigger uses 60-min threshold; scheduled uses 120-min
  const isTransition    = setup.trigger_type === 'transition'
  const thresholdMinutes = isTransition ? 60 : 120

  return {
    activityState:         setup.activity_state as never,
    nowIso,
    lastInitiationAt,
    thresholdMinutes,
    consecutiveDismissals: setup.consecutive_dismissals,
    pausedUntil:           setup.paused_until
  }
}

// ─── Test runner ──────────────────────────────────────────────────────────────

const scenarios = loadGateScenarios()

describe('Golden Gate Scenarios', () => {
  for (const scenario of scenarios) {
    it(`${scenario.id}: ${scenario.description}`, () => {
      const params  = buildGateParams(scenario.setup)
      const { results, passed } = evaluateAllGates(params)
      const exp     = scenario.expected

      // Overall pass/hold
      expect(passed, `[${scenario.id}] overall should be ${exp.overall}`).toBe(exp.overall === 'pass')

      // Individual gate assertions — skip means key should be absent
      const gateKeys = ['gate1', 'gate2', 'gate3', 'gate4', 'gate5'] as const
      const expKeys  = ['gate_1', 'gate_2', 'gate_3', 'gate_4', 'gate_5'] as const

      for (let i = 0; i < gateKeys.length; i++) {
        const resultKey = gateKeys[i]
        const expKey    = expKeys[i]
        const expVal    = exp[expKey]

        if (!expVal || expVal === 'skip') {
          // Gate was not evaluated — key should be absent
          expect(
            results[resultKey],
            `[${scenario.id}] ${resultKey} should be absent (gate not reached)`
          ).toBeUndefined()
        } else {
          expect(
            results[resultKey],
            `[${scenario.id}] ${resultKey} should be ${expVal}`
          ).toBe(expVal)
        }
      }

      // action_type check: 'SILENCE' when overall=hold, 'INITIATE' means non-SILENCE
      if (exp.action_type === 'SILENCE') {
        expect(passed, `[${scenario.id}] SILENCE implies gates did not pass`).toBe(false)
      } else {
        // 'INITIATE' — gates passed, actual action is LLM-determined (not tested here)
        expect(passed, `[${scenario.id}] INITIATE implies gates passed`).toBe(true)
      }
    })
  }
})

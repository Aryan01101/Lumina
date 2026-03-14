/**
 * Settings Store Tests — Phase 8
 *
 * Tests the pure settings logic — defaults, get/set, validation.
 * No electron dependency (persistence layer is swappable).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  getSettings,
  getSetting,
  setSetting,
  resetSettings,
  type AppSettings
} from '../../src/main/settings'

beforeEach(() => { resetSettings() })

// ─── Default values ───────────────────────────────────────────────────────────

describe('default settings', () => {
  it('default model is llama3.1:8b', () => {
    expect(getSetting('model')).toBe('llama3.1:8b')
  })

  it('activityMonitorEnabled defaults to true', () => {
    expect(getSetting('activityMonitorEnabled')).toBe(true)
  })

  it('checkinFrequency defaults to "normal"', () => {
    expect(getSetting('checkinFrequency')).toBe('normal')
  })

  it('observability defaults to "off"', () => {
    expect(getSetting('observability')).toBe('off')
  })

  it('onboardingComplete defaults to false', () => {
    expect(getSetting('onboardingComplete')).toBe(false)
  })

  it('getSettings returns all 6 keys with correct types', () => {
    const s = getSettings()
    expect(s).toHaveProperty('model')
    expect(s).toHaveProperty('activityMonitorEnabled')
    expect(s).toHaveProperty('checkinFrequency')
    expect(s).toHaveProperty('observability')
    expect(s).toHaveProperty('langfuseKey')
    expect(s).toHaveProperty('onboardingComplete')
  })
})

// ─── get / set ────────────────────────────────────────────────────────────────

describe('setSetting / getSetting', () => {
  it('setting model persists and is retrievable', () => {
    setSetting('model', 'phi3:mini')
    expect(getSetting('model')).toBe('phi3:mini')
  })

  it('setting activityMonitorEnabled to false persists', () => {
    setSetting('activityMonitorEnabled', false)
    expect(getSetting('activityMonitorEnabled')).toBe(false)
  })

  it('setting onboardingComplete to true persists', () => {
    setSetting('onboardingComplete', true)
    expect(getSetting('onboardingComplete')).toBe(true)
  })

  it('getSettings returns a snapshot — mutating it does not affect the store', () => {
    const s = getSettings() as AppSettings & Record<string, unknown>
    s.model = 'hacked'
    expect(getSetting('model')).toBe('llama3.1:8b')
  })
})

// ─── Validation ───────────────────────────────────────────────────────────────

describe('setSetting validation', () => {
  it('throws on invalid checkinFrequency value', () => {
    expect(() => setSetting('checkinFrequency', 'ultra-fast' as never)).toThrow(/invalid/i)
  })

  it('throws on invalid observability value', () => {
    expect(() => setSetting('observability', 'datadog' as never)).toThrow(/invalid/i)
  })

  it('accepts valid checkinFrequency values', () => {
    expect(() => setSetting('checkinFrequency', 'relaxed')).not.toThrow()
    expect(() => setSetting('checkinFrequency', 'active')).not.toThrow()
  })

  it('accepts valid observability values', () => {
    expect(() => setSetting('observability', 'local')).not.toThrow()
    expect(() => setSetting('observability', 'langfuse')).not.toThrow()
  })
})

// ─── resetSettings ────────────────────────────────────────────────────────────

describe('resetSettings', () => {
  it('restores all defaults after changes', () => {
    setSetting('model', 'custom-model')
    setSetting('activityMonitorEnabled', false)
    setSetting('onboardingComplete', true)
    resetSettings()
    expect(getSetting('model')).toBe('llama3.1:8b')
    expect(getSetting('activityMonitorEnabled')).toBe(true)
    expect(getSetting('onboardingComplete')).toBe(false)
  })
})

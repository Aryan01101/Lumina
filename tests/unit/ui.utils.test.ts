/**
 * Renderer Utility Function Tests — Phase 8
 *
 * Pure functions extracted from renderer components.
 * No DOM, no React, no Electron — just logic.
 */
import { describe, it, expect } from 'vitest'
import { canLogMood, MOOD_RATE_LIMIT_MS } from '../../src/renderer/src/utils/mood'
import { shouldAutoHide } from '../../src/renderer/src/utils/autoHide'
import {
  formatGroundednessScore,
  mapActionTypeToAnimation
} from '../../src/renderer/src/utils/format'

// ─── canLogMood ───────────────────────────────────────────────────────────────

describe('canLogMood', () => {
  const now = new Date('2026-03-10T10:00:00Z').toISOString()

  it('returns true when lastLoggedAt is null (never logged)', () => {
    expect(canLogMood(null, now)).toBe(true)
  })

  it('returns false when logged 30 minutes ago (within 4h window)', () => {
    const recent = new Date('2026-03-10T09:30:00Z').toISOString()
    expect(canLogMood(recent, now)).toBe(false)
  })

  it('returns false when logged exactly at 4h boundary (must be MORE than 4h)', () => {
    const exactly4h = new Date(new Date(now).getTime() - MOOD_RATE_LIMIT_MS).toISOString()
    expect(canLogMood(exactly4h, now)).toBe(false)
  })

  it('returns true when logged more than 4 hours ago', () => {
    const old = new Date('2026-03-10T05:00:00Z').toISOString()  // 5 hours ago
    expect(canLogMood(old, now)).toBe(true)
  })

  it('returns false when logged 1 minute ago', () => {
    const veryRecent = new Date(new Date(now).getTime() - 60_000).toISOString()
    expect(canLogMood(veryRecent, now)).toBe(false)
  })
})

// ─── shouldAutoHide ───────────────────────────────────────────────────────────

describe('shouldAutoHide', () => {
  it('DEEP_WORK → true', () => {
    expect(shouldAutoHide('DEEP_WORK')).toBe(true)
  })

  it('GAMING → true', () => {
    expect(shouldAutoHide('GAMING')).toBe(true)
  })

  it('VIDEO_CALL → true', () => {
    expect(shouldAutoHide('VIDEO_CALL')).toBe(true)
  })

  it('STUDY → true', () => {
    expect(shouldAutoHide('STUDY')).toBe(true)
  })

  it('BROWSING → false', () => {
    expect(shouldAutoHide('BROWSING')).toBe(false)
  })

  it('IDLE → false', () => {
    expect(shouldAutoHide('IDLE')).toBe(false)
  })

  it('PASSIVE_CONTENT → false', () => {
    expect(shouldAutoHide('PASSIVE_CONTENT')).toBe(false)
  })

  it('LUMINA → false', () => {
    expect(shouldAutoHide('LUMINA')).toBe(false)
  })
})

// ─── formatGroundednessScore ──────────────────────────────────────────────────

describe('formatGroundednessScore', () => {
  it('formats 0.87 as "87%"', () => {
    expect(formatGroundednessScore(0.87)).toBe('87%')
  })

  it('formats 1.0 as "100%"', () => {
    expect(formatGroundednessScore(1.0)).toBe('100%')
  })

  it('formats 0 as "0%"', () => {
    expect(formatGroundednessScore(0)).toBe('0%')
  })

  it('returns null when score is null', () => {
    expect(formatGroundednessScore(null)).toBeNull()
  })

  it('rounds to nearest integer', () => {
    expect(formatGroundednessScore(0.876)).toBe('88%')
  })
})

// ─── mapActionTypeToAnimation ─────────────────────────────────────────────────

describe('mapActionTypeToAnimation', () => {
  it('CELEBRATE → "celebrating"', () => {
    expect(mapActionTypeToAnimation('CELEBRATE')).toBe('celebrating')
  })

  it('CHECKIN → "happy"', () => {
    expect(mapActionTypeToAnimation('CHECKIN')).toBe('happy')
  })

  it('NUDGE → "concerned"', () => {
    expect(mapActionTypeToAnimation('NUDGE')).toBe('concerned')
  })

  it('SILENCE → "idle"', () => {
    expect(mapActionTypeToAnimation('SILENCE')).toBe('idle')
  })
})

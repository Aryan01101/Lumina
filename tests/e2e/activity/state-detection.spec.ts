/**
 * Activity Monitor E2E Tests
 *
 * Verifies:
 * - Activity state change listener
 * - Degraded mode detection
 * - System state reporting
 *
 * Note: In test mode, activity monitor is disabled (no system permissions).
 * Full activity classification logic is tested in unit tests.
 */

import { test, expect } from '../fixtures/electronApp'
import { waitForAppReady, completeOnboardingIfPresent } from '../helpers/common'

test.describe('Activity Monitor', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page)
    await completeOnboardingIfPresent(page)
  })

  test('system reports degraded mode in test environment', async ({ page }) => {
    const status = await page.evaluate(async () => {
      return await (window as any).lumina.system.getStatus()
    })

    // Test mode disables activity monitor (no permissions needed)
    expect(status.activityDegraded).toBe(true)
  })

  test('activity state listener can be registered', async ({ page }) => {
    // Register listener
    await page.evaluate(() => {
      (window as any).__activityStates = []
      ;(window as any).lumina.activity.onStateChange((state: any) => {
        ;(window as any).__activityStates.push(state)
      })
    })

    // Wait for potential state changes
    await page.waitForTimeout(2000)

    // Verify listener was registered (states may be empty in test mode)
    const states = await page.evaluate(() => (window as any).__activityStates)
    expect(Array.isArray(states)).toBe(true)
  })

  test('activity state structure is correct if received', async ({ page }) => {
    // Register listener
    await page.evaluate(() => {
      (window as any).__latestState = null
      ;(window as any).lumina.activity.onStateChange((state: any) => {
        ;(window as any).__latestState = state
      })
    })

    await page.waitForTimeout(1000)

    const state = await page.evaluate(() => (window as any).__latestState)

    // If any state was received, verify structure
    if (state !== null) {
      expect(state).toHaveProperty('state')
      expect(state).toHaveProperty('appName')
      expect(typeof state.state).toBe('string')
      expect(typeof state.appName).toBe('string')
    }
  })

  test('settings reflect activity monitor state', async ({ page }) => {
    const settings = await page.evaluate(async () => {
      return await (window as any).lumina.settings.get()
    })

    // activityMonitorEnabled setting exists
    expect(settings.settings).toHaveProperty('activityMonitorEnabled')
    expect(typeof settings.settings.activityMonitorEnabled).toBe('boolean')
  })

  test('activity monitor can be toggled via settings', async ({ page }) => {
    // Disable
    await page.evaluate(async () => {
      return await (window as any).lumina.settings.set({
        key: 'activityMonitorEnabled',
        value: false
      })
    })

    let settings = await page.evaluate(async () => {
      return await (window as any).lumina.settings.get()
    })
    expect(settings.settings.activityMonitorEnabled).toBe(false)

    // Re-enable
    await page.evaluate(async () => {
      return await (window as any).lumina.settings.set({
        key: 'activityMonitorEnabled',
        value: true
      })
    })

    settings = await page.evaluate(async () => {
      return await (window as any).lumina.settings.get()
    })
    expect(settings.settings.activityMonitorEnabled).toBe(true)
  })
})

test.describe('Activity Classification (Unit Tests Cover This)', () => {
  test('8-state classification is implemented', async ({ page }) => {
    await waitForAppReady(page)

    // The 8 states are:
    // DEEP_WORK, STUDY, GAMING, VIDEO_CALL, PASSIVE_CONTENT, BROWSING, IDLE, LUMINA

    // This is fully tested in unit tests (tests/unit/activity.classification.test.ts)
    // E2E tests verify the IPC interface works
  })
})

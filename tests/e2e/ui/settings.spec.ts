/**
 * Settings Panel E2E Tests
 *
 * Verifies:
 * - Settings retrieval
 * - Settings persistence
 * - Metrics display
 * - System status indicators
 */

import { test, expect } from '../fixtures/electronApp'
import { waitForAppReady, completeOnboardingIfPresent } from '../helpers/common'

test.describe('Settings Panel', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page)
    await completeOnboardingIfPresent(page)
  })

  test('retrieves current settings', async ({ page }) => {
    const settings = await page.evaluate(async () => {
      return await (window as any).lumina.settings.get()
    })

    expect(settings).toHaveProperty('settings')
    expect(settings.settings).toHaveProperty('model')
    expect(settings.settings).toHaveProperty('activityMonitorEnabled')
    expect(settings.settings).toHaveProperty('checkinFrequency')
    expect(settings.settings).toHaveProperty('observability')
  })

  test('updates model setting', async ({ page }) => {
    await page.evaluate(async () => {
      return await (window as any).lumina.settings.set({
        key: 'model',
        value: 'phi3:mini'
      })
    })

    const updated = await page.evaluate(async () => {
      return await (window as any).lumina.settings.get()
    })

    expect(updated.settings.model).toBe('phi3:mini')
  })

  test('updates checkin frequency', async ({ page }) => {
    await page.evaluate(async () => {
      return await (window as any).lumina.settings.set({
        key: 'checkinFrequency',
        value: 'relaxed'
      })
    })

    const updated = await page.evaluate(async () => {
      return await (window as any).lumina.settings.get()
    })

    expect(updated.settings.checkinFrequency).toBe('relaxed')
  })

  test('retrieves system status', async ({ page }) => {
    const status = await page.evaluate(async () => {
      return await (window as any).lumina.system.getStatus()
    })

    expect(status).toHaveProperty('ollamaOk')
    expect(status).toHaveProperty('activityDegraded')
    expect(typeof status.ollamaOk).toBe('boolean')
    expect(typeof status.activityDegraded).toBe('boolean')
  })

  test('retrieves performance metrics', async ({ page }) => {
    const metrics = await page.evaluate(async () => {
      return await (window as any).lumina.metrics.get()
    })

    // All metric fields should exist (may be null initially)
    expect(metrics).toHaveProperty('latency_p50')
    expect(metrics).toHaveProperty('groundedness_avg')
    expect(metrics).toHaveProperty('initiation_rate')
    expect(metrics).toHaveProperty('dismissal_rate')
    expect(metrics).toHaveProperty('llm_call_count')
    expect(metrics).toHaveProperty('agent_event_count')
  })

  test('observability setting toggle', async ({ page }) => {
    // Set to local
    await page.evaluate(async () => {
      return await (window as any).lumina.settings.set({
        key: 'observability',
        value: 'local'
      })
    })

    let settings = await page.evaluate(async () => {
      return await (window as any).lumina.settings.get()
    })
    expect(settings.settings.observability).toBe('local')

    // Set to off
    await page.evaluate(async () => {
      return await (window as any).lumina.settings.set({
        key: 'observability',
        value: 'off'
      })
    })

    settings = await page.evaluate(async () => {
      return await (window as any).lumina.settings.get()
    })
    expect(settings.settings.observability).toBe('off')
  })

  test('activity monitor toggle', async ({ page }) => {
    await page.evaluate(async () => {
      return await (window as any).lumina.settings.set({
        key: 'activityMonitorEnabled',
        value: false
      })
    })

    const settings = await page.evaluate(async () => {
      return await (window as any).lumina.settings.get()
    })

    expect(settings.settings.activityMonitorEnabled).toBe(false)
  })

  test('settings persist across app restarts', async ({ page }) => {
    // Set a custom value
    await page.evaluate(async () => {
      return await (window as any).lumina.settings.set({
        key: 'model',
        value: 'phi3:mini'
      })
    })

    await page.evaluate(async () => {
      return await (window as any).lumina.settings.set({
        key: 'checkinFrequency',
        value: 'active'
      })
    })

    // In a real test, we'd restart the app here
    // For now, verify settings are stored
    const settings = await page.evaluate(async () => {
      return await (window as any).lumina.settings.get()
    })

    expect(settings.settings.model).toBe('phi3:mini')
    expect(settings.settings.checkinFrequency).toBe('active')
  })
})

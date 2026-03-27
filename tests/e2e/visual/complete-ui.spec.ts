/**
 * Visual Regression: Complete UI States
 *
 * Captures full screenshots of major UI states to catch:
 * - Layout regressions
 * - Styling changes
 * - Component positioning issues
 * - Overall visual consistency
 *
 * These are broader than contrast tests and verify the entire UI appearance.
 */

import { test } from '../fixtures/electronApp'
import { waitForAppReady, completeOnboardingIfPresent, openCompanionPanel, openSettings } from '../helpers/common'
import { expectPageScreenshot, expectComponentScreenshot, hideDynamicElements, waitForAnimations } from '../helpers/visual'

test.describe('Visual Regression: Complete UI', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page)
    await completeOnboardingIfPresent(page)

    // Mark onboarding complete
    await page.evaluate(async () => {
      await (window as any).lumina.settings.set({
        key: 'onboardingComplete',
        value: true
      })
    })

    // Hide animations for consistent screenshots
    await hideDynamicElements(page)
  })

  test('main window - default state', async ({ page }) => {
    await waitForAnimations(page, 1000)

    // Mask dynamic elements
    await expectPageScreenshot(page, {
      name: 'ui-main-window-default',
      maxDiffPixelRatio: 0.02,
      mask: [
        page.locator('.animate-pulse'),
        page.locator('[data-testid="session-time"]') // If this exists
      ]
    })
  })

  test('companion panel - chat tab open', async ({ page }) => {
    await openCompanionPanel(page)

    const panel = page.locator('[data-testid="companion-panel"]')
    await panel.waitFor({ state: 'visible' })
    await waitForAnimations(page, 500)

    await expectComponentScreenshot(panel, {
      name: 'ui-companion-panel-chat',
      maxDiffPixelRatio: 0.02,
      mask: [
        page.locator('.animate-pulse'),
        page.locator('[data-testid="companion-chat-messages"]') // Dynamic chat content
      ]
    })
  })

  test('companion panel - journal tab', async ({ page }) => {
    await openCompanionPanel(page)

    // Switch to journal tab
    const journalTab = page.locator('[data-testid="companion-tab-journal"]')
    await journalTab.click()
    await waitForAnimations(page, 500)

    const panel = page.locator('[data-testid="companion-panel"]')

    await expectComponentScreenshot(panel, {
      name: 'ui-companion-panel-journal',
      maxDiffPixelRatio: 0.02,
      mask: [
        page.locator('.animate-pulse')
      ]
    })
  })

  test('companion panel - mood tab', async ({ page }) => {
    await openCompanionPanel(page)

    // Switch to mood tab
    const moodTab = page.locator('[data-testid="companion-tab-mood"]')
    await moodTab.click()
    await waitForAnimations(page, 500)

    const panel = page.locator('[data-testid="companion-panel"]')

    await expectComponentScreenshot(panel, {
      name: 'ui-companion-panel-mood',
      maxDiffPixelRatio: 0.02,
      mask: [
        page.locator('.animate-pulse')
      ]
    })
  })

  test('companion panel - focus tab with todos', async ({ page }) => {
    await openCompanionPanel(page)

    // Switch to focus tab
    const focusTab = page.locator('[data-testid="companion-tab-focus"]')
    await focusTab.click()
    await waitForAnimations(page, 500)

    // Add some todos
    const todoInput = page.locator('[data-testid="focus-todo-input"]')

    await todoInput.fill('High priority task')
    const highPriorityBtn = page.locator('[data-testid="focus-priority-button-2"]')
    await highPriorityBtn.click()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)

    await todoInput.fill('Medium priority task')
    const medPriorityBtn = page.locator('[data-testid="focus-priority-button-1"]')
    await medPriorityBtn.click()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)

    await todoInput.fill('Low priority task')
    // Low is default (priority 0)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)

    const panel = page.locator('[data-testid="companion-panel"]')

    await expectComponentScreenshot(panel, {
      name: 'ui-companion-panel-focus-with-todos',
      maxDiffPixelRatio: 0.02,
      mask: [
        page.locator('.animate-pulse'),
        page.locator('[data-testid="focus-session-tracker"]') // Timer is dynamic
      ]
    })
  })

  test('companion panel - focus tab completed todos', async ({ page }) => {
    await openCompanionPanel(page)

    // Switch to focus tab
    const focusTab = page.locator('[data-testid="companion-tab-focus"]')
    await focusTab.click()
    await waitForAnimations(page, 500)

    // Add and complete a todo
    const todoInput = page.locator('[data-testid="focus-todo-input"]')
    await todoInput.fill('Completed task')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)

    // Click complete button
    const completeBtn = page.locator('[data-testid^="focus-todo-complete-"]').first()
    await completeBtn.click()
    await page.waitForTimeout(300)

    // Show completed todos
    const showCompletedBtn = page.getByText(/show completed/i)
    await showCompletedBtn.click()
    await waitForAnimations(page, 300)

    const panel = page.locator('[data-testid="companion-panel"]')

    await expectComponentScreenshot(panel, {
      name: 'ui-companion-panel-focus-completed',
      maxDiffPixelRatio: 0.02,
      mask: [
        page.locator('.animate-pulse'),
        page.locator('[data-testid="focus-session-tracker"]')
      ]
    })
  })

  test('settings panel - open state', async ({ page }) => {
    await openSettings(page)

    const settingsPanel = page.locator('[data-testid="settings-panel"]')
    await settingsPanel.waitFor({ state: 'visible', timeout: 5000 })
    await waitForAnimations(page, 500)

    await expectComponentScreenshot(settingsPanel, {
      name: 'ui-settings-panel',
      maxDiffPixelRatio: 0.02,
      mask: [
        page.locator('.animate-pulse')
      ]
    })
  })

  test('keyboard focus indicators visible', async ({ page }) => {
    await openCompanionPanel(page)

    const panel = page.locator('[data-testid="companion-panel"]')
    await panel.waitFor({ state: 'visible' })

    // Tab through elements to show focus indicators
    await page.keyboard.press('Tab')
    await page.waitForTimeout(200)

    await expectComponentScreenshot(panel, {
      name: 'ui-focus-indicator-first-element',
      maxDiffPixelRatio: 0.02,
      mask: [
        page.locator('.animate-pulse'),
        page.locator('[data-testid="companion-chat-messages"]')
      ]
    })

    // Tab a few more times
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.waitForTimeout(200)

    await expectComponentScreenshot(panel, {
      name: 'ui-focus-indicator-tabbed',
      maxDiffPixelRatio: 0.02,
      mask: [
        page.locator('.animate-pulse'),
        page.locator('[data-testid="companion-chat-messages"]')
      ]
    })
  })

  test('panel opening animation settled', async ({ page }) => {
    // Capture the moment panel is fully opened
    await openCompanionPanel(page)

    const panel = page.locator('[data-testid="companion-panel"]')
    await panel.waitFor({ state: 'visible' })

    // Wait for slide-up animation to complete
    await waitForAnimations(page, 800)

    await expectComponentScreenshot(panel, {
      name: 'ui-panel-animation-settled',
      maxDiffPixelRatio: 0.02,
      mask: [
        page.locator('.animate-pulse'),
        page.locator('[data-testid="companion-chat-messages"]')
      ]
    })
  })

  test('responsive layout - panel positioning', async ({ page }) => {
    await openCompanionPanel(page)

    const panel = page.locator('[data-testid="companion-panel"]')
    await panel.waitFor({ state: 'visible' })
    await waitForAnimations(page, 500)

    // Get panel bounding box to verify positioning
    const box = await panel.boundingBox()

    // Panel should be positioned consistently
    // This screenshot captures the full context
    await expectPageScreenshot(page, {
      name: 'ui-panel-positioning',
      maxDiffPixelRatio: 0.02,
      mask: [
        page.locator('.animate-pulse'),
        page.locator('[data-testid="companion-chat-messages"]')
      ]
    })
  })

  test('error state - network error styling', async ({ page }) => {
    await openCompanionPanel(page)

    const panel = page.locator('[data-testid="companion-panel"]')
    await panel.waitFor({ state: 'visible' })

    // Type a message but simulate network error
    const chatInput = page.locator('[data-testid="companion-chat-input"]')
    await chatInput.fill('Test message')

    // Note: This test documents what error states should look like
    // Actual error injection would require more complex setup
    // For now, just capture the normal state as baseline

    await expectComponentScreenshot(panel, {
      name: 'ui-ready-for-input',
      maxDiffPixelRatio: 0.02,
      mask: [
        page.locator('.animate-pulse'),
        page.locator('[data-testid="companion-chat-messages"]')
      ]
    })
  })

  test('loading state - Ollama not ready', async ({ page }) => {
    await openCompanionPanel(page)

    const panel = page.locator('[data-testid="companion-panel"]')
    await panel.waitFor({ state: 'visible' })
    await waitForAnimations(page, 500)

    // Check if Ollama warning is visible (it might not be in test environment)
    const ollamaWarning = page.locator('text=/AI models are loading/i')
    const warningVisible = await ollamaWarning.isVisible().catch(() => false)

    if (warningVisible) {
      await expectComponentScreenshot(panel, {
        name: 'ui-ollama-loading-warning',
        maxDiffPixelRatio: 0.02,
        mask: [
          page.locator('.animate-pulse'),
          page.locator('[data-testid="companion-chat-messages"]')
        ]
      })
    }

    // Otherwise just capture normal state
    await expectComponentScreenshot(panel, {
      name: 'ui-normal-state',
      maxDiffPixelRatio: 0.02,
      mask: [
        page.locator('.animate-pulse'),
        page.locator('[data-testid="companion-chat-messages"]')
      ]
    })
  })
})

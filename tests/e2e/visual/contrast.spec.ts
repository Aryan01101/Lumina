/**
 * Visual Regression: Color Contrast
 *
 * Captures screenshots of UI elements to visually verify:
 * - Text contrast against backgrounds
 * - Focus states visibility
 * - Hover states visibility
 * - Disabled states distinguishability
 *
 * These tests catch regressions in color contrast that might be
 * introduced by theme changes or CSS updates.
 */

import { test, expect } from '../fixtures/electronApp'
import { waitForAppReady, completeOnboardingIfPresent, openCompanionPanel } from '../helpers/common'
import { expectComponentScreenshot, hideDynamicElements, waitForAnimations } from '../helpers/visual'

test.describe('Visual Regression: Color Contrast', () => {
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

  test('CompanionPanel - default state text contrast', async ({ page }) => {
    // Open companion panel
    await openCompanionPanel(page)

    // Wait for panel and animations
    const panel = page.locator('[data-testid="companion-panel"]')
    await panel.waitFor({ state: 'visible' })
    await waitForAnimations(page, 500)

    // Capture panel screenshot
    await expectComponentScreenshot(panel, {
      name: 'contrast-companion-panel-default',
      maxDiffPixelRatio: 0.02,
      mask: [
        page.locator('.animate-pulse'), // Hide pulsing dots
        page.locator('[data-testid="companion-chat-messages"]') // Hide chat content (dynamic)
      ]
    })
  })

  test('CompanionPanel - inactive tab text contrast', async ({ page }) => {
    await openCompanionPanel(page)

    const panel = page.locator('[data-testid="companion-panel"]')
    await panel.waitFor({ state: 'visible' })
    await waitForAnimations(page, 500)

    // Focus on tabs to show contrast
    const tabs = page.locator('[data-testid="companion-tabs"]')

    await expectComponentScreenshot(tabs, {
      name: 'contrast-tabs-inactive',
      maxDiffPixelRatio: 0.02
    })
  })

  test('CompanionPanel - close button contrast', async ({ page }) => {
    await openCompanionPanel(page)

    const closeButton = page.locator('[data-testid="companion-close-button"]')
    await closeButton.waitFor({ state: 'visible' })

    await expectComponentScreenshot(closeButton, {
      name: 'contrast-close-button-default',
      maxDiffPixelRatio: 0.02
    })
  })

  test('CompanionPanel - placeholder text contrast', async ({ page }) => {
    await openCompanionPanel(page)

    // Chat input with placeholder
    const chatInput = page.locator('[data-testid="companion-chat-input"]')
    await chatInput.waitFor({ state: 'visible' })
    await waitForAnimations(page, 300)

    await expectComponentScreenshot(chatInput, {
      name: 'contrast-chat-input-placeholder',
      maxDiffPixelRatio: 0.02
    })
  })

  test('FocusTab - empty state text contrast', async ({ page }) => {
    await openCompanionPanel(page)

    // Switch to focus tab
    const focusTab = page.locator('[data-testid="companion-tab-focus"]')
    await focusTab.click()
    await waitForAnimations(page, 300)

    // Capture empty state
    const emptyState = page.locator('[data-testid="focus-empty-state"]')
    await emptyState.waitFor({ state: 'visible' })

    await expectComponentScreenshot(emptyState, {
      name: 'contrast-focus-empty-state',
      maxDiffPixelRatio: 0.02
    })
  })

  test('FocusTab - priority buttons unselected contrast', async ({ page }) => {
    await openCompanionPanel(page)

    // Switch to focus tab
    const focusTab = page.locator('[data-testid="companion-tab-focus"]')
    await focusTab.click()
    await waitForAnimations(page, 300)

    // Capture priority buttons
    const priorityButtons = page.locator('[data-testid="focus-priority-buttons"]')
    await priorityButtons.waitFor({ state: 'visible' })

    await expectComponentScreenshot(priorityButtons, {
      name: 'contrast-priority-buttons-unselected',
      maxDiffPixelRatio: 0.02
    })
  })

  test('FocusTab - delete icon contrast', async ({ page }) => {
    await openCompanionPanel(page)

    // Switch to focus tab
    const focusTab = page.locator('[data-testid="companion-tab-focus"]')
    await focusTab.click()
    await waitForAnimations(page, 300)

    // Add a todo first
    const todoInput = page.locator('[data-testid="focus-todo-input"]')
    await todoInput.fill('Test todo for contrast')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)

    // Find the delete button
    const deleteButton = page.locator('[data-testid^="focus-todo-delete-"]').first()
    await deleteButton.waitFor({ state: 'visible' })

    await expectComponentScreenshot(deleteButton, {
      name: 'contrast-delete-icon-default',
      maxDiffPixelRatio: 0.02
    })
  })

  test('FocusTab - session info text contrast', async ({ page }) => {
    await openCompanionPanel(page)

    // Switch to focus tab
    const focusTab = page.locator('[data-testid="companion-tab-focus"]')
    await focusTab.click()
    await waitForAnimations(page, 300)

    // Capture session tracker
    const sessionTracker = page.locator('[data-testid="focus-session-tracker"]')
    await sessionTracker.waitFor({ state: 'visible' })

    await expectComponentScreenshot(sessionTracker, {
      name: 'contrast-session-tracker',
      maxDiffPixelRatio: 0.02,
      mask: [
        page.locator('.animate-pulse') // Hide pulsing dot
      ]
    })
  })

  test('Focus states - keyboard navigation contrast', async ({ page }) => {
    await openCompanionPanel(page)

    const chatInput = page.locator('[data-testid="companion-chat-input"]')
    await chatInput.waitFor({ state: 'visible' })

    // Focus the input using keyboard
    await chatInput.focus()
    await waitForAnimations(page, 200)

    // Capture focused input
    await expectComponentScreenshot(chatInput, {
      name: 'contrast-input-focused',
      maxDiffPixelRatio: 0.02
    })
  })

  test('Hover states - button hover contrast', async ({ page }) => {
    await openCompanionPanel(page)

    const closeButton = page.locator('[data-testid="companion-close-button"]')
    await closeButton.waitFor({ state: 'visible' })

    // Hover over button
    await closeButton.hover()
    await waitForAnimations(page, 200)

    await expectComponentScreenshot(closeButton, {
      name: 'contrast-close-button-hover',
      maxDiffPixelRatio: 0.02
    })
  })

  test('Active states - tab active contrast', async ({ page }) => {
    await openCompanionPanel(page)

    const tabs = page.locator('[data-testid="companion-tabs"]')
    await tabs.waitFor({ state: 'visible' })

    // Chat tab should be active by default
    const activeTab = page.locator('[data-testid="companion-tab-chat"]')

    await expectComponentScreenshot(activeTab, {
      name: 'contrast-tab-active',
      maxDiffPixelRatio: 0.02
    })
  })

  test('Disabled states - send button disabled', async ({ page }) => {
    await openCompanionPanel(page)

    // Send button should be disabled when input is empty
    const sendButton = page.locator('[data-testid="companion-chat-send-button"]')
    await sendButton.waitFor({ state: 'visible' })

    // Verify it's disabled
    const isDisabled = await sendButton.isDisabled()
    expect(isDisabled).toBe(true)

    await expectComponentScreenshot(sendButton, {
      name: 'contrast-button-disabled',
      maxDiffPixelRatio: 0.02
    })
  })
})

/**
 * Common E2E test helpers
 */

import { Page } from '@playwright/test'

/**
 * Wait for Lumina to finish loading (Ollama models pulled, DB ready)
 */
export async function waitForAppReady(page: Page, timeout = 30_000): Promise<void> {
  await page.waitForFunction(
    () => {
      return (window as any).lumina !== undefined
    },
    { timeout }
  )

  // Wait for system status to be available
  await page.evaluate(async () => {
    const status = await (window as any).lumina.system.getStatus()
    return status
  })
}

/**
 * Click the companion character to open the panel
 */
export async function openCompanionPanel(page: Page): Promise<void> {
  // Find and click the companion character
  const companion = page.locator('[data-testid="companion-character"], .companion-character, button').first()
  await companion.click()

  // Wait for panel to be visible
  await page.waitForSelector('[data-testid="companion-panel"], .companion-panel', { timeout: 5000 })
}

/**
 * Switch to a specific tab in the companion panel
 */
export async function switchToTab(page: Page, tab: 'chat' | 'journal' | 'mood'): Promise<void> {
  const tabButton = page.locator(`button:has-text("${tab}")`, {
    hasText: new RegExp(tab, 'i')
  })
  await tabButton.click()
  await page.waitForTimeout(300) // Tab transition
}

/**
 * Send a chat message and wait for response
 */
export async function sendChatMessage(page: Page, message: string): Promise<string> {
  const input = page.locator('input[type="text"], textarea').filter({ hasText: '' }).first()
  await input.fill(message)
  await input.press('Enter')

  // Wait for streaming response to complete
  let response = ''
  await page.waitForFunction(
    () => {
      const messages = document.querySelectorAll('[data-role="assistant"], .assistant-message')
      return messages.length > 0
    },
    { timeout: 30_000 }
  )

  // Extract response text
  response = await page.locator('[data-role="assistant"], .assistant-message').last().textContent() || ''
  return response.trim()
}

/**
 * Open settings panel
 */
export async function openSettings(page: Page): Promise<void> {
  const settingsButton = page.locator('button[aria-label="Settings"], svg').first()
  await settingsButton.click()
  await page.waitForSelector('[data-testid="settings-panel"], .settings, text="Settings"', { timeout: 5000 })
}

/**
 * Complete onboarding if it appears
 */
export async function completeOnboardingIfPresent(page: Page): Promise<void> {
  const isOnboarding = await page.locator('text="Welcome", text="Lumina"').count() > 0

  if (!isOnboarding) return

  // Click through onboarding steps
  const nextButton = page.locator('button:has-text("Next"), button:has-text("Continue"), button:has-text("Get Started")')

  let attempts = 0
  while (attempts < 5) {
    const count = await nextButton.count()
    if (count === 0) break

    await nextButton.first().click()
    await page.waitForTimeout(500)
    attempts++
  }
}

/**
 * Get metrics from settings
 */
export async function getMetrics(page: Page): Promise<{
  latency_p50: number | null
  groundedness_avg: number | null
  initiation_rate: number | null
  dismissal_rate: number | null
}> {
  return await page.evaluate(async () => {
    return await (window as any).lumina.metrics.get()
  })
}

/**
 * Visual Regression Test Helpers
 *
 * Utilities for consistent screenshot capture and comparison.
 */

import { expect } from '@playwright/test'
import type { Page, Locator } from '@playwright/test'

export interface VisualTestOptions {
  /**
   * Name of the screenshot (used for baseline comparison)
   */
  name: string

  /**
   * Maximum allowed pixel difference ratio (0-1)
   * Default: 0.01 (1%)
   */
  maxDiffPixelRatio?: number

  /**
   * Mask elements that might have dynamic content (animations, timers, etc.)
   */
  mask?: Locator[]

  /**
   * Wait for specific element to be visible before capturing
   */
  waitFor?: Locator

  /**
   * Delay before capturing (for animations to settle)
   */
  delay?: number
}

/**
 * Capture and compare a full-page screenshot
 */
export async function expectPageScreenshot(
  page: Page,
  options: VisualTestOptions
): Promise<void> {
  const { name, maxDiffPixelRatio, mask, waitFor, delay } = options

  // Wait for element if specified
  if (waitFor) {
    await waitFor.waitFor({ state: 'visible', timeout: 5000 })
  }

  // Delay if specified (for animations)
  if (delay) {
    await page.waitForTimeout(delay)
  }

  // Take screenshot and compare
  await page.screenshot({
    path: `test-results/screenshots/${name}.png`,
    animations: 'disabled',
    mask
  })

  await page.waitForLoadState('networkidle')

  await expect(page).toHaveScreenshot(`${name}.png`, {
    maxDiffPixelRatio,
    mask
  })
}

/**
 * Capture and compare a component screenshot
 */
export async function expectComponentScreenshot(
  locator: Locator,
  options: VisualTestOptions
): Promise<void> {
  const { name, maxDiffPixelRatio, mask, waitFor, delay } = options

  // Wait for element if specified
  if (waitFor) {
    await waitFor.waitFor({ state: 'visible', timeout: 5000 })
  }

  // Wait for the locator itself
  await locator.waitFor({ state: 'visible', timeout: 5000 })

  // Delay if specified (for animations)
  if (delay) {
    await locator.page().waitForTimeout(delay)
  }

  // Take screenshot and compare
  await expect(locator).toHaveScreenshot(`${name}.png`, {
    maxDiffPixelRatio,
    mask
  })
}

/**
 * Wait for all animations to complete
 */
export async function waitForAnimations(page: Page, timeout = 1000): Promise<void> {
  await page.waitForTimeout(timeout)

  // Also wait for CSS animations/transitions
  await page.evaluate(() => {
    return Promise.all(
      document.getAnimations().map(animation => animation.finished)
    )
  }).catch(() => {
    // Ignore errors if no animations
  })
}

/**
 * Hide dynamic elements (timers, pulsing dots, etc.) for consistent screenshots
 */
export async function hideDynamicElements(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      /* Hide animations */
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }

      /* Hide pulsing elements */
      .animate-pulse {
        animation: none !important;
      }
    `
  })
}

/**
 * Electron App Fixture for Playwright E2E Tests
 *
 * Launches Lumina with:
 * - Isolated user data directory per test
 * - Test database (in-memory or temp file)
 * - Mocked Ollama server (optional)
 * - Activity monitor disabled (no system permissions needed)
 */

import { test as base, _electron as electron, ElectronApplication, Page } from '@playwright/test'
import { join } from 'path'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'

export interface ElectronFixtures {
  electronApp: ElectronApplication
  page: Page
}

export const test = base.extend<ElectronFixtures>({
  electronApp: async ({}, use) => {
    // Create isolated temp dir for this test
    const userDataDir = mkdtempSync(join(tmpdir(), 'lumina-test-'))

    // Launch Electron with test environment
    const app = await electron.launch({
      args: [join(__dirname, '../../../out/main/index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        LUMINA_USER_DATA: userDataDir,
        LUMINA_TEST_MODE: '1',
        // Disable activity monitor in tests (no system permissions)
        LUMINA_DISABLE_ACTIVITY_MONITOR: '1'
      }
    })

    // Wait for app to be ready
    await app.evaluate(async ({ app }) => {
      return app.whenReady()
    })

    await use(app)

    // Cleanup
    await app.close()
    try {
      rmSync(userDataDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  },

  page: async ({ electronApp }, use) => {
    // Get the main window
    const window = await electronApp.firstWindow()
    await use(window)
  }
})

export { expect } from '@playwright/test'

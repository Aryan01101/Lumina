import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for Lumina Electron E2E tests
 *
 * Tests run against the built Electron app with a test database.
 * Ollama is mocked for deterministic LLM responses.
 */
export default defineConfig({
  testDir: './tests/e2e',

  // Timeout per test — LLM calls can be slow even when mocked
  timeout: 60_000,

  // Expect timeout for assertions
  expect: {
    timeout: 10_000
  },

  // Run tests in parallel
  fullyParallel: false, // Electron apps share global state

  // Fail fast on CI
  forbidOnly: !!process.env.CI,

  // Retry failed tests
  retries: process.env.CI ? 2 : 0,

  // Limit parallel workers for Electron (each launches full app)
  workers: 1,

  // Reporter config
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ],

  // Output config
  use: {
    // Base URL not applicable for Electron
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },

  // No web server needed — we launch Electron directly
  projects: [
    {
      name: 'electron',
      testMatch: '**/*.spec.ts'
    }
  ]
})

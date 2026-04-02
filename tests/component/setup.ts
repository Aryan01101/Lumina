/**
 * Component Test Setup
 *
 * Configures React Testing Library and jest-dom matchers for component tests.
 * This file is automatically loaded before each test run (configured in vitest.config.ts).
 */

import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Clean up after each test
afterEach(() => {
  cleanup()
})

// Mock window.lumina API for component tests
// This prevents components from throwing errors when they try to call IPC methods
// Only run this in browser-like environments (happy-dom), not in Node environment (unit tests)
if (typeof window !== 'undefined') {
  (global as any).window.lumina = {
    chat: {
      sendMessage: vi.fn(),
      onDelta: vi.fn(() => () => {}),
      onDone: vi.fn(() => () => {}),
      onToolResult: vi.fn(() => () => {}),
      listConversations: vi.fn(() => Promise.resolve({ conversations: [] })),
      getHistory: vi.fn(() => Promise.resolve({ messages: [] }))
    },
    journal: {
      create: vi.fn(() => Promise.resolve({ ok: true }))
    },
    mood: {
      log: vi.fn(() => Promise.resolve({ ok: true }))
    },
    todos: {
      list: vi.fn(() => Promise.resolve({ ok: true, todos: [] })),
      create: vi.fn(() => Promise.resolve({ ok: true })),
      complete: vi.fn(() => Promise.resolve({ ok: true })),
      uncomplete: vi.fn(() => Promise.resolve({ ok: true })),
      delete: vi.fn(() => Promise.resolve({ ok: true }))
    },
    ccm: {
      getPending: vi.fn(() => Promise.resolve({ proposals: [] })),
      resolve: vi.fn(() => Promise.resolve({ ok: true }))
    },
    settings: {
      get: vi.fn(() => Promise.resolve({ settings: { onboardingComplete: true } })),
      set: vi.fn(() => Promise.resolve({ ok: true }))
    },
    system: {
      getStatus: vi.fn(() => Promise.resolve({ ollamaOk: true, activityDegraded: false })),
      onStatus: vi.fn(() => () => {}),
      onPullProgress: vi.fn(() => () => {}),
      retryEmbeddings: vi.fn(() => Promise.resolve({ ollamaOk: true })),
      openUrl: vi.fn()
    },
    activity: {
      getCurrentSession: vi.fn(() => Promise.resolve({ sessionMinutes: 0, activityState: 'BROWSING' })),
      onStateChange: vi.fn(() => () => {})
    },
    agent: {
      onStatus: vi.fn(() => () => {})
    },
    window: {
      setIgnoreMouseEvents: vi.fn(),
      onTogglePanel: vi.fn(() => () => {})
    },
    metrics: {
      get: vi.fn(() => Promise.resolve({
        latency_p50: null,
        groundedness_avg: null,
        initiation_rate: null,
        dismissal_rate: null
      }))
    }
  } as any
}

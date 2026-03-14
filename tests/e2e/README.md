# Lumina E2E Tests

Comprehensive Playwright E2E test suite for Lumina, covering all 4 core AI systems and user-facing features.

## Quick Start

```bash
# Install dependencies (if not already installed)
npm install

# Run all E2E tests
npm run test:e2e

# Run smoke tests only (critical path)
npm run test:e2e:smoke

# Run specific test file
npm run test:e2e -- tests/e2e/ui/chat.spec.ts

# Run in interactive UI mode
npm run test:e2e:ui

# Run in debug mode
npm run test:e2e:debug
```

## Test Structure

```
tests/e2e/
├── fixtures/
│   └── electronApp.ts        — Electron app launch fixture
├── helpers/
│   └── common.ts              — Reusable helper functions
├── smoke.spec.ts              — Critical path tests (run first)
├── ui/
│   ├── chat.spec.ts          — Chat interface
│   ├── journal.spec.ts       — Journal system
│   ├── mood.spec.ts          — Mood logging
│   └── settings.spec.ts      — Settings panel
├── agent/
│   └── gates.spec.ts         — Agent gates & metrics
├── memory/
│   └── retrieval.spec.ts     — Memory & RAG
└── activity/
    └── state-detection.spec.ts — Activity monitor
```

## Writing Tests

### Use the Electron Fixture

```typescript
import { test, expect } from '../fixtures/electronApp'

test('your test name', async ({ page, electronApp }) => {
  // page: Playwright Page object for the main window
  // electronApp: ElectronApplication instance

  await page.evaluate(async () => {
    return await (window as any).lumina.settings.get()
  })
})
```

### Common Helpers

```typescript
import { waitForAppReady, completeOnboardingIfPresent } from '../helpers/common'

test.beforeEach(async ({ page }) => {
  await waitForAppReady(page)
  await completeOnboardingIfPresent(page)
})
```

### IPC Testing Pattern

All Lumina features are accessible via the `window.lumina` API:

```typescript
// Chat
await page.evaluate(async () => {
  return await (window as any).lumina.chat.sendMessage({
    content: 'Hello',
    conversationId: 'new'
  })
})

// Journal
await page.evaluate(async () => {
  return await (window as any).lumina.journal.create({
    content: 'Journal entry',
    mode: 'freeform'
  })
})

// Mood
await page.evaluate(async () => {
  return await (window as any).lumina.mood.log({
    value: 'good'
  })
})

// Memory
await page.evaluate(async () => {
  return await (window as any).lumina.memory.search('query')
})

// Settings
await page.evaluate(async () => {
  return await (window as any).lumina.settings.get()
})

// Metrics
await page.evaluate(async () => {
  return await (window as any).lumina.metrics.get()
})
```

### Listening to Events

```typescript
// Chat delta events
await page.evaluate(() => {
  (window as any).__chatDeltas = []
  ;(window as any).lumina.chat.onDelta((delta: string) => {
    ;(window as any).__chatDeltas.push(delta)
  })
})

// Later, retrieve deltas
const deltas = await page.evaluate(() => (window as any).__chatDeltas)

// Agent status
await page.evaluate(() => {
  (window as any).__agentStatus = null
  ;(window as any).lumina.agent.onStatus((status: any) => {
    ;(window as any).__agentStatus = status
  })
})

// Activity state
await page.evaluate(() => {
  (window as any).__activityStates = []
  ;(window as any).lumina.activity.onStateChange((state: any) => {
    ;(window as any).__activityStates.push(state)
  })
})
```

## Test Isolation

Each test runs in a completely isolated environment:

- **Fresh database:** In-memory or temp file per test
- **Isolated user data:** Temp directory created/destroyed per test
- **No shared state:** Tests do not interfere with each other

This is handled automatically by the `electronApp` fixture.

## Test Environment

In test mode, the app runs with:

```typescript
env: {
  NODE_ENV: 'test',
  LUMINA_TEST_MODE: '1',
  LUMINA_DISABLE_ACTIVITY_MONITOR: '1'  // No system permissions needed
}
```

This means:
- Activity monitor is disabled (no macOS Accessibility permission needed)
- Each test gets an isolated temp directory
- Activity state will be reported as "degraded" in `system.getStatus()`

### Reranker Graceful Degradation

The reranker (ONNX cross-encoder model) is **optional** and degrades gracefully:

- If the model download fails, retrieval continues with similarity-only ranking
- If the worker times out (>10s), returns similarity-based scores
- If the worker crashes, pending requests resolve with fallback scores
- **Impact:** Retrieval still works, just without the precision boost from reranking

This is by design. The app never blocks or fails due to reranker issues.

Tests for this behavior: `tests/e2e/memory/reranker-fallback.spec.ts`

## Debugging

### Visual Debugging

```bash
npm run test:e2e:debug
```

Opens Playwright Inspector for step-by-step debugging.

### Screenshots on Failure

Screenshots are automatically captured on test failure and saved to `test-results/`.

### Verbose Logging

Add `--trace on` to capture detailed execution traces:

```bash
npx playwright test --trace on
```

View traces:

```bash
npx playwright show-trace test-results/.../trace.zip
```

## Common Patterns

### Wait for Background Operations

```typescript
// Journal entry triggers background embedding
await page.evaluate(async () => {
  return await (window as any).lumina.journal.create({
    content: 'Test entry',
    mode: 'freeform'
  })
})

// Wait for embedding to start (not necessarily complete)
await page.waitForTimeout(1000)
```

### Test Metrics Updates

```typescript
const before = await page.evaluate(async () => {
  return await (window as any).lumina.metrics.get()
})

// Perform action that updates metrics
await page.evaluate(async () => {
  return await (window as any).lumina.chat.sendMessage({
    content: 'Test',
    conversationId: 'new'
  })
})

await page.waitForTimeout(2000)

const after = await page.evaluate(async () => {
  return await (window as any).lumina.metrics.get()
})

expect(after.llm_call_count).toBeGreaterThan(before.llm_call_count)
```

### Verify Data Persistence

```typescript
// Create data
const result = await page.evaluate(async () => {
  return await (window as any).lumina.journal.create({
    content: 'Persistent entry',
    mode: 'freeform'
  })
})

// Verify it was saved
expect(result.id).toBeGreaterThan(0)

// Retrieve it (via memory search or conversation history)
const retrieved = await page.evaluate(async () => {
  return await (window as any).lumina.memory.search('persistent')
})
```

## Performance Testing

Verify PRD targets:

```typescript
test('retrieval latency < 250ms', async ({ page }) => {
  const result = await page.evaluate(async () => {
    return await (window as any).lumina.memory.search('test query')
  })

  expect(result.durationMs).toBeLessThan(250)
})
```

## CI Integration

Add to `.github/workflows/e2e.yml`:

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npm run test:e2e
```

## Troubleshooting

### "Cannot find module 'electron'"

Make sure you've run `npm install` and the app is built:

```bash
npm install
npm run build
```

### "Timeout waiting for app to launch"

Increase timeout in fixture or check if Ollama models are downloading (slows first launch):

```typescript
await waitForAppReady(page, 60_000)  // 60 second timeout
```

### "Activity monitor degraded"

This is expected in test mode. Tests don't require system permissions.

### Tests fail with "Connection refused"

Ollama server isn't running. Tests work without Ollama (return error messages gracefully), but some tests expect responses.

### "Could not locate file" reranker error

The reranker is trying to download an ONNX model from HuggingFace. This is **not a test failure**:

- Retrieval continues with similarity-only ranking (no reranking)
- All tests should still pass
- If you have a slow/blocked internet connection, this is expected
- The warning message explains the fallback behavior

## Coverage Report

Current coverage:

- **65 E2E tests** covering:
  - Smoke tests (8)
  - UI flows (28)
  - Agent system (7)
  - Memory & RAG (8)
  - Reranker graceful degradation (8)
  - Activity monitor (6)

- **22 Unit tests** covering:
  - Business logic
  - Algorithms
  - Golden scenarios

See `TEST_RESULTS.md` for detailed coverage analysis.

---

**Questions?** Check the [main README](../../README.md) or review existing tests for patterns.

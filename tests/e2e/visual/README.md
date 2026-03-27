# Visual Regression Tests

Playwright-based visual regression tests for UI consistency.

## How It Works

Visual regression tests capture screenshots of the UI and compare them against baseline images. If pixels differ beyond the configured threshold, the test fails.

## Running Tests

```bash
# Run all visual tests
npm run test:e2e -- tests/e2e/visual

# Update baselines (when intentional changes are made)
npm run test:e2e -- tests/e2e/visual --update-snapshots

# Debug mode
npm run test:e2e:debug -- tests/e2e/visual
```

## File Structure

```
tests/e2e/visual/
├── README.md (this file)
├── contrast.spec.ts (color contrast visual tests)
├── complete-ui.spec.ts (full UI screenshots)
└── *.spec.ts-snapshots/ (baseline images, auto-generated)
```

## Writing Visual Tests

### Basic Pattern

```typescript
import { test } from '@playwright/test'
import { electronApp } from '../fixtures/electronApp'
import { expectComponentScreenshot } from '../helpers/visual'

test('component looks correct', async ({ page }) => {
  const { window } = await electronApp()

  // Navigate to state
  await window.locator('[data-testid="my-component"]').waitFor()

  // Capture and compare
  await expectComponentScreenshot(
    window.locator('[data-testid="my-component"]'),
    {
      name: 'my-component-default',
      maxDiffPixelRatio: 0.01, // 1% threshold
      delay: 500 // Wait for animations
    }
  )
})
```

### Masking Dynamic Content

```typescript
await expectPageScreenshot(page, {
  name: 'dashboard',
  mask: [
    page.locator('[data-testid="session-timer"]'), // Hides timer
    page.locator('.animate-pulse') // Hides all pulsing elements
  ]
})
```

## Best Practices

1. **Disable Animations:** Use `delay` or `waitForAnimations()` helper
2. **Mask Dynamic Content:** Hide timers, random data, pulsing indicators
3. **Consistent State:** Always navigate to same state before capturing
4. **Descriptive Names:** Use `component-state-variant.png` naming
5. **Threshold Tuning:** Start with 0.01 (1%), adjust if too sensitive
6. **Update Baselines Carefully:** Review diffs before `--update-snapshots`

## Reviewing Failures

When a visual test fails, Playwright generates:
- **Actual:** Current screenshot
- **Expected:** Baseline screenshot
- **Diff:** Highlighted differences

These are saved in `test-results/` and shown in the HTML report:

```bash
npx playwright show-report playwright-report
```

## Common Issues

### Flaky Tests (Random Failures)

- **Cause:** Animations, timers, fonts not loaded
- **Fix:** Increase delay, mask dynamic elements, wait for fonts

### Too Sensitive (Fails on Minor Changes)

- **Cause:** Anti-aliasing, sub-pixel rendering differences
- **Fix:** Increase `maxDiffPixelRatio` or `threshold`

### Always Different on CI

- **Cause:** Different OS/fonts between local and CI
- **Fix:** Generate baselines on CI or use Docker for consistency

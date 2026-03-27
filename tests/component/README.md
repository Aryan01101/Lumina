# Component Tests

React component tests using React Testing Library and Vitest.

## Setup

- **Environment:** happy-dom (simulates browser DOM)
- **Framework:** React Testing Library + Vitest
- **Accessibility:** jest-axe for a11y testing
- **Mocks:** window.lumina API is mocked globally (see setup.ts)

## Test ID Convention

All interactive elements should have `data-testid` attributes following this pattern:

```tsx
// Pattern: {component}-{element}-{identifier?}
<button data-testid="focus-priority-button-0">1</button>
<input data-testid="focus-todo-input" />
<div data-testid="companion-panel" />
```

## Running Tests

```bash
# Run all component tests
npm test -- tests/component

# Run specific test file
npm test -- tests/component/FocusTab.test.tsx

# Watch mode
npm test -- tests/component --watch

# With coverage
npm test -- tests/component --coverage
```

## File Naming

- `{Component}.test.tsx` - Main component tests
- `{Component}.accessibility.test.tsx` - Accessibility-specific tests
- `{Component}.{feature}.test.tsx` - Feature-specific tests (e.g., FocusTab.delete.test.tsx)

## Writing Tests

### Basic Component Test

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import MyComponent from '@renderer/components/MyComponent'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByTestId('my-component')).toBeInTheDocument()
  })
})
```

### Accessibility Test

```tsx
import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { describe, it, expect } from 'vitest'

expect.extend(toHaveNoViolations)

describe('MyComponent Accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<MyComponent />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
```

### User Interaction Test

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'

describe('MyComponent Interactions', () => {
  it('handles button click', async () => {
    const user = userEvent.setup()
    render(<MyComponent />)

    const button = screen.getByTestId('my-button')
    await user.click(button)

    expect(screen.getByText('Clicked!')).toBeInTheDocument()
  })
})
```

## Best Practices

1. **Query Priority:** Use `getByTestId` for reliable queries
2. **User Events:** Use `userEvent` instead of `fireEvent` for realistic interactions
3. **Async:** Always await async operations
4. **Cleanup:** Automatic via afterEach in setup.ts
5. **Mocks:** Use vi.fn() for functions, check setup.ts for global mocks
6. **Accessibility:** Run axe tests on all components

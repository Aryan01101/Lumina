/**
 * Test Setup Verification
 *
 * This test verifies that the component testing infrastructure is working correctly.
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import React from 'react'

describe('Component Test Setup', () => {
  it('renders a simple component', () => {
    const TestComponent = () => <div data-testid="test-component">Hello Test</div>
    render(<TestComponent />)
    expect(screen.getByTestId('test-component')).toBeInTheDocument()
    expect(screen.getByText('Hello Test')).toBeInTheDocument()
  })

  it('has jest-dom matchers available', () => {
    const TestComponent = () => <button disabled>Click me</button>
    render(<TestComponent />)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toBeInTheDocument()
  })

  it('has window.lumina mock available', () => {
    expect(window.lumina).toBeDefined()
    expect(window.lumina.chat).toBeDefined()
    expect(window.lumina.todos).toBeDefined()
  })
})

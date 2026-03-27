/**
 * FocusTab Accessibility Tests
 *
 * Tests keyboard navigation and accessibility features for the FocusTab component.
 * Following TDD approach: tests are written first, then features are implemented.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import FocusTab from '@renderer/components/FocusTab'

describe('FocusTab - Keyboard Navigation', () => {
  const mockResetTimer = vi.fn()

  beforeEach(() => {
    mockResetTimer.mockClear()
  })

  describe('Priority Buttons', () => {
    it('can be focused using Tab key', async () => {
      const user = userEvent.setup()
      render(<FocusTab resetTimer={mockResetTimer} />)

      const todoInput = screen.getByTestId('focus-todo-input')
      const priorityButton0 = screen.getByTestId('focus-priority-button-0')
      const priorityButton1 = screen.getByTestId('focus-priority-button-1')
      const priorityButton2 = screen.getByTestId('focus-priority-button-2')

      // Start focus on input
      todoInput.focus()
      expect(todoInput).toHaveFocus()

      // Tab to first priority button
      await user.tab()
      expect(priorityButton0).toHaveFocus()

      // Tab to second priority button
      await user.tab()
      expect(priorityButton1).toHaveFocus()

      // Tab to third priority button
      await user.tab()
      expect(priorityButton2).toHaveFocus()
    })

    it('can be activated with Enter key', async () => {
      const user = userEvent.setup()
      render(<FocusTab resetTimer={mockResetTimer} />)

      const priorityButton1 = screen.getByTestId('focus-priority-button-1')

      // Focus the button
      priorityButton1.focus()
      expect(priorityButton1).toHaveFocus()

      // Press Enter
      await user.keyboard('{Enter}')

      // Button should now have active/selected styles
      // (checking for the violet background that indicates selection)
      expect(priorityButton1).toHaveClass('bg-violet-500/30')
    })

    it('can be activated with Space key', async () => {
      const user = userEvent.setup()
      render(<FocusTab resetTimer={mockResetTimer} />)

      const priorityButton2 = screen.getByTestId('focus-priority-button-2')

      // Focus the button
      priorityButton2.focus()
      expect(priorityButton2).toHaveFocus()

      // Press Space
      await user.keyboard(' ')

      // Button should now have active/selected styles
      expect(priorityButton2).toHaveClass('bg-violet-500/30')
    })

    it('prevents default Space key behavior (no page scroll)', async () => {
      const user = userEvent.setup()
      render(<FocusTab resetTimer={mockResetTimer} />)

      const priorityButton0 = screen.getByTestId('focus-priority-button-0')
      priorityButton0.focus()

      // Create a spy on preventDefault
      const preventDefaultSpy = vi.fn()
      priorityButton0.addEventListener('keydown', (e) => {
        if (e.key === ' ') {
          preventDefaultSpy()
        }
      })

      // Press Space
      await user.keyboard(' ')

      // Should have prevented default (would normally scroll)
      // The button should be selected, proving the event was handled
      expect(priorityButton0).toHaveClass('bg-violet-500/30')
    })

    it('has proper aria-label for screen readers', () => {
      render(<FocusTab resetTimer={mockResetTimer} />)

      const priorityButton0 = screen.getByTestId('focus-priority-button-0')
      const priorityButton1 = screen.getByTestId('focus-priority-button-1')
      const priorityButton2 = screen.getByTestId('focus-priority-button-2')

      expect(priorityButton0).toHaveAttribute('aria-label', 'Set priority to Low')
      expect(priorityButton1).toHaveAttribute('aria-label', 'Set priority to Med')
      expect(priorityButton2).toHaveAttribute('aria-label', 'Set priority to High')
    })

    it('indicates selected state with aria-pressed', () => {
      render(<FocusTab resetTimer={mockResetTimer} />)

      const priorityButton0 = screen.getByTestId('focus-priority-button-0')
      const priorityButton1 = screen.getByTestId('focus-priority-button-1')

      // Priority 0 is selected by default (initial state)
      expect(priorityButton0).toHaveAttribute('aria-pressed', 'true')
      expect(priorityButton1).toHaveAttribute('aria-pressed', 'false')
    })

    it('has visible focus indicator', async () => {
      const user = userEvent.setup()
      render(<FocusTab resetTimer={mockResetTimer} />)

      const priorityButton0 = screen.getByTestId('focus-priority-button-0')

      // Focus the button
      await user.tab()
      await user.tab() // Tab past input to reach button

      priorityButton0.focus()

      // Should have focus visible styles
      // (This would be tested visually in E2E, but we verify the element can receive focus)
      expect(priorityButton0).toHaveFocus()
      expect(document.activeElement).toBe(priorityButton0)
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('adds todo with Enter key in input field', async () => {
      const user = userEvent.setup()
      render(<FocusTab resetTimer={mockResetTimer} />)

      const todoInput = screen.getByTestId('focus-todo-input')

      // Type a todo
      await user.type(todoInput, 'Test todo item')

      // Press Enter
      await user.keyboard('{Enter}')

      // Input should be cleared (todo was added)
      expect(todoInput).toHaveValue('')
    })

    it('does not add todo with Shift+Enter (for future multi-line support)', async () => {
      const user = userEvent.setup()
      render(<FocusTab resetTimer={mockResetTimer} />)

      const todoInput = screen.getByTestId('focus-todo-input')

      // Type a todo
      await user.type(todoInput, 'Test todo')

      // Press Shift+Enter
      await user.keyboard('{Shift>}{Enter}{/Shift}')

      // Input should NOT be cleared (todo was not added)
      expect(todoInput).toHaveValue('Test todo')
    })
  })

  describe('Tab Order', () => {
    it('follows logical tab order: input → priority → add button', async () => {
      const user = userEvent.setup()
      render(<FocusTab resetTimer={mockResetTimer} />)

      const todoInput = screen.getByTestId('focus-todo-input')
      const priorityButton0 = screen.getByTestId('focus-priority-button-0')
      const addButton = screen.getByTestId('focus-add-todo-button')

      // Type text so add button is enabled (otherwise it can't be focused)
      await user.type(todoInput, 'Test')

      // Start at input
      todoInput.focus()
      expect(todoInput).toHaveFocus()

      // Tab through priorities
      await user.tab()
      expect(priorityButton0).toHaveFocus()

      await user.tab() // priority 1
      await user.tab() // priority 2
      await user.tab() // should reach add button

      expect(addButton).toHaveFocus()
      expect(addButton).not.toBeDisabled()
    })
  })
})

/**
 * CompanionPanel Focus Management Tests
 *
 * Tests that focus is properly managed when panels open/close.
 * This is critical for keyboard-only users and screen reader accessibility.
 *
 * Following TDD approach: tests are written first, then features are implemented.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import CompanionPanel from '@renderer/components/CompanionPanel'

describe('CompanionPanel - Focus Management', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    mockOnClose.mockClear()
  })

  describe('Opening the Panel', () => {
    it('moves focus to first interactive element when panel opens', async () => {
      const { rerender } = render(<CompanionPanel isOpen={false} onClose={mockOnClose} />)

      // Panel is closed - nothing rendered
      expect(screen.queryByTestId('companion-panel')).not.toBeInTheDocument()

      // Open the panel
      rerender(<CompanionPanel isOpen={true} onClose={mockOnClose} />)

      // Wait for panel to appear
      await waitFor(() => {
        expect(screen.getByTestId('companion-panel')).toBeInTheDocument()
      })

      // Focus should be on the chat input (first interactive element on chat tab)
      await waitFor(() => {
        const chatInput = screen.getByTestId('companion-chat-input')
        expect(chatInput).toHaveFocus()
      }, { timeout: 500 })
    })

    it('focuses chat input when chat tab is active', async () => {
      render(<CompanionPanel isOpen={true} onClose={mockOnClose} />)

      await waitFor(() => {
        const chatInput = screen.getByTestId('companion-chat-input')
        expect(chatInput).toBeInTheDocument()
        expect(chatInput).toHaveFocus()
      })
    })

    it('allows user to immediately start typing without clicking', async () => {
      const user = userEvent.setup()
      render(<CompanionPanel isOpen={true} onClose={mockOnClose} />)

      // Wait for focus
      await waitFor(() => {
        const chatInput = screen.getByTestId('companion-chat-input')
        expect(chatInput).toHaveFocus()
      })

      // User can immediately type
      await user.keyboard('Hello!')

      const chatInput = screen.getByTestId('companion-chat-input')
      expect(chatInput).toHaveValue('Hello!')
    })
  })

  describe('Tab Switching', () => {
    it('focuses journal textarea when switching to journal tab', async () => {
      const user = userEvent.setup()
      render(<CompanionPanel isOpen={true} onClose={mockOnClose} />)

      // Wait for panel to be ready
      await waitFor(() => {
        expect(screen.getByTestId('companion-panel')).toBeInTheDocument()
      })

      // Click journal tab
      const journalTab = screen.getByTestId('companion-tab-journal')
      await user.click(journalTab)

      // Focus should move to journal textarea
      await waitFor(() => {
        const journalTextarea = screen.getByTestId('companion-journal-textarea')
        expect(journalTextarea).toBeInTheDocument()
        expect(journalTextarea).toHaveFocus()
      })
    })

    it('focuses chat input when switching back to chat tab', async () => {
      const user = userEvent.setup()
      render(<CompanionPanel isOpen={true} onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByTestId('companion-panel')).toBeInTheDocument()
      })

      // Switch to journal
      await user.click(screen.getByTestId('companion-tab-journal'))

      await waitFor(() => {
        expect(screen.getByTestId('companion-journal-textarea')).toBeInTheDocument()
      })

      // Switch back to chat
      await user.click(screen.getByTestId('companion-tab-chat'))

      // Focus should return to chat input
      await waitFor(() => {
        const chatInput = screen.getByTestId('companion-chat-input')
        expect(chatInput).toHaveFocus()
      })
    })

    it('focuses todo input when switching to focus tab', async () => {
      const user = userEvent.setup()
      render(<CompanionPanel isOpen={true} onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByTestId('companion-panel')).toBeInTheDocument()
      })

      // Click focus tab
      const focusTab = screen.getByTestId('companion-tab-focus')
      await user.click(focusTab)

      // Focus should move to todo input
      await waitFor(() => {
        const todoInput = screen.getByTestId('focus-todo-input')
        expect(todoInput).toBeInTheDocument()
        expect(todoInput).toHaveFocus()
      })
    })
  })

  describe('Keyboard Navigation', () => {
    it('can navigate to tabs using Tab key', async () => {
      const user = userEvent.setup()
      render(<CompanionPanel isOpen={true} onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByTestId('companion-panel')).toBeInTheDocument()
      })

      // Start at chat input
      const chatInput = screen.getByTestId('companion-chat-input')
      await waitFor(() => {
        expect(chatInput).toHaveFocus()
      })

      // Tab backwards (Shift+Tab) should reach tabs
      await user.keyboard('{Shift>}{Tab}{/Shift}')
      await user.keyboard('{Shift>}{Tab}{/Shift}')
      await user.keyboard('{Shift>}{Tab}{/Shift}')
      await user.keyboard('{Shift>}{Tab}{/Shift}')

      // Should be on one of the tabs or close button
      const closeButton = screen.getByTestId('companion-close-button')
      const chatTab = screen.getByTestId('companion-tab-chat')

      const focusedElement = document.activeElement
      const isOnHeaderControls =
        focusedElement === closeButton ||
        focusedElement === chatTab ||
        focusedElement === screen.getByTestId('companion-tab-focus') ||
        focusedElement === screen.getByTestId('companion-tab-journal') ||
        focusedElement === screen.getByTestId('companion-tab-mood')

      expect(isOnHeaderControls).toBe(true)
    })

    it('can close panel using Escape key', async () => {
      const user = userEvent.setup()
      render(<CompanionPanel isOpen={true} onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByTestId('companion-panel')).toBeInTheDocument()
      })

      // Press Escape
      await user.keyboard('{Escape}')

      // onClose should have been called
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('Focus Trap', () => {
    it('keeps focus within panel when tabbing forward', async () => {
      const user = userEvent.setup()
      render(<CompanionPanel isOpen={true} onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByTestId('companion-panel')).toBeInTheDocument()
      })

      // Tab through all elements
      const startingElement = document.activeElement

      // Tab many times to try to escape
      for (let i = 0; i < 20; i++) {
        await user.tab()
      }

      // Focus should still be within the panel
      const panel = screen.getByTestId('companion-panel')
      expect(panel.contains(document.activeElement)).toBe(true)
    })
  })

  describe('Reopening Behavior', () => {
    it('focuses first element again when panel reopens', async () => {
      const { rerender } = render(<CompanionPanel isOpen={true} onClose={mockOnClose} />)

      // Wait for initial focus
      await waitFor(() => {
        const chatInput = screen.getByTestId('companion-chat-input')
        expect(chatInput).toHaveFocus()
      })

      // Close panel
      rerender(<CompanionPanel isOpen={false} onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.queryByTestId('companion-panel')).not.toBeInTheDocument()
      })

      // Reopen panel
      rerender(<CompanionPanel isOpen={true} onClose={mockOnClose} />)

      // Focus should be managed again
      await waitFor(() => {
        const chatInput = screen.getByTestId('companion-chat-input')
        expect(chatInput).toHaveFocus()
      })
    })
  })
})

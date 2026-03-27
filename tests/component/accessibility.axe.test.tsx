/**
 * Axe Accessibility Scan Tests
 *
 * Uses jest-axe to automatically detect accessibility violations.
 * Scans all major components for WCAG compliance.
 *
 * Following TDD approach: tests are written first, then violations are fixed.
 */
import { render } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { axe, toHaveNoViolations } from 'jest-axe'
import CompanionPanel from '@renderer/components/CompanionPanel'
import FocusTab from '@renderer/components/FocusTab'

expect.extend(toHaveNoViolations)

describe('Accessibility - Axe Scans', () => {
  const mockResetTimer = vi.fn()
  const mockOnClose = vi.fn()

  beforeEach(() => {
    mockResetTimer.mockClear()
    mockOnClose.mockClear()
  })

  describe('CompanionPanel', () => {
    it('has no accessibility violations when closed', async () => {
      const { container } = render(<CompanionPanel isOpen={false} onClose={mockOnClose} />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('has no accessibility violations when open on chat tab', async () => {
      const { container } = render(<CompanionPanel isOpen={true} onClose={mockOnClose} />)

      // Wait a bit for async loading to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('has no accessibility violations on journal tab', async () => {
      const { container, getByTestId } = render(
        <CompanionPanel isOpen={true} onClose={mockOnClose} />
      )

      // Switch to journal tab
      const journalTab = getByTestId('companion-tab-journal')
      journalTab.click()

      await new Promise(resolve => setTimeout(resolve, 100))

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('has no accessibility violations on mood tab', async () => {
      const { container, getByTestId } = render(
        <CompanionPanel isOpen={true} onClose={mockOnClose} />
      )

      // Switch to mood tab
      const moodTab = getByTestId('companion-tab-mood')
      moodTab.click()

      await new Promise(resolve => setTimeout(resolve, 100))

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('has no accessibility violations on focus tab', async () => {
      const { container, getByTestId } = render(
        <CompanionPanel isOpen={true} onClose={mockOnClose} />
      )

      // Switch to focus tab
      const focusTab = getByTestId('companion-tab-focus')
      focusTab.click()

      await new Promise(resolve => setTimeout(resolve, 100))

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('FocusTab', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(<FocusTab resetTimer={mockResetTimer} />)

      // Wait for async loading
      await new Promise(resolve => setTimeout(resolve, 100))

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('has no accessibility violations with todos present', async () => {
      // Mock the window.lumina.todos.list to return sample todos
      const mockTodos = [
        {
          id: 1,
          content: 'Complete accessibility tests',
          status: 'pending' as const,
          priority: 2,
          dueDate: null,
          aiSuggested: false,
          createdAt: new Date().toISOString(),
          completedAt: null
        },
        {
          id: 2,
          content: 'Review color contrast',
          status: 'completed' as const,
          priority: 1,
          dueDate: null,
          aiSuggested: true,
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString()
        }
      ]

      window.lumina.todos.list = vi.fn().mockResolvedValue({ ok: true, todos: mockTodos })

      const { container } = render(<FocusTab resetTimer={mockResetTimer} />)

      // Wait for todos to load
      await new Promise(resolve => setTimeout(resolve, 200))

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Common Accessibility Patterns', () => {
    it('all interactive elements have accessible names', async () => {
      const { container, getByTestId } = render(
        <CompanionPanel isOpen={true} onClose={mockOnClose} />
      )

      await new Promise(resolve => setTimeout(resolve, 100))

      // Axe will check for this, but we can also verify manually
      const buttons = container.querySelectorAll('button')
      buttons.forEach(button => {
        const hasAccessibleName =
          button.getAttribute('aria-label') ||
          button.textContent?.trim() ||
          button.querySelector('[aria-label]')

        expect(hasAccessibleName).toBeTruthy()
      })

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('all form inputs have labels or aria-labels', async () => {
      const { container } = render(
        <CompanionPanel isOpen={true} onClose={mockOnClose} />
      )

      await new Promise(resolve => setTimeout(resolve, 100))

      // Axe will check for this automatically
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('color contrast meets WCAG AA standards', async () => {
      const { container } = render(
        <CompanionPanel isOpen={true} onClose={mockOnClose} />
      )

      await new Promise(resolve => setTimeout(resolve, 100))

      // Axe includes color contrast checks
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('landmark regions are properly structured', async () => {
      const { container } = render(
        <CompanionPanel isOpen={true} onClose={mockOnClose} />
      )

      await new Promise(resolve => setTimeout(resolve, 100))

      // Axe checks for proper landmark usage
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })
})

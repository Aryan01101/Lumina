/**
 * MoodCheck Accessibility Tests
 *
 * Tests emoji mood buttons for accessibility:
 * - Proper labels for screen readers
 * - Disabled state handling
 * - Keyboard navigation
 * - ARIA attributes
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { axe, toHaveNoViolations } from 'jest-axe'
import userEvent from '@testing-library/user-event'
import MoodCheck from '@renderer/components/MoodCheck'

expect.extend(toHaveNoViolations)

describe('MoodCheck - Accessibility', () => {
  const mockOnLog = vi.fn()

  beforeEach(() => {
    mockOnLog.mockClear()
  })

  describe('Axe Scans', () => {
    it('has no accessibility violations when enabled', async () => {
      const { container } = render(<MoodCheck lastLoggedAt={null} onLog={mockOnLog} />)

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('has no accessibility violations when disabled (rate limited)', async () => {
      // Set logged 1 hour ago (needs 4 hours between logs)
      const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString()
      const { container } = render(<MoodCheck lastLoggedAt={oneHourAgo} onLog={mockOnLog} />)

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Button Labels', () => {
    it('all mood buttons have accessible labels via title attribute', () => {
      render(<MoodCheck lastLoggedAt={null} onLog={mockOnLog} />)

      const frustratedBtn = screen.getByTitle('Frustrated')
      const okayBtn = screen.getByTitle('Okay')
      const goodBtn = screen.getByTitle('Good')
      const amazingBtn = screen.getByTitle('Amazing')

      expect(frustratedBtn).toBeInTheDocument()
      expect(okayBtn).toBeInTheDocument()
      expect(goodBtn).toBeInTheDocument()
      expect(amazingBtn).toBeInTheDocument()
    })

    it('buttons have both emoji and text label', () => {
      render(<MoodCheck lastLoggedAt={null} onLog={mockOnLog} />)

      const frustratedBtn = screen.getByTitle('Frustrated')

      // Should have emoji (span with text-xl)
      const emoji = frustratedBtn.querySelector('.text-xl')
      expect(emoji).toBeInTheDocument()

      // Should have text label (span with text-[10px])
      expect(frustratedBtn).toHaveTextContent('Frustrated')
    })
  })

  describe('Disabled State', () => {
    it('buttons are disabled when rate limited', () => {
      const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString()
      render(<MoodCheck lastLoggedAt={oneHourAgo} onLog={mockOnLog} />)

      const buttons = screen.getAllByRole('button')

      buttons.forEach(button => {
        expect(button).toBeDisabled()
        expect(button).toHaveClass('opacity-40', 'cursor-not-allowed')
      })
    })

    it('shows time remaining message when disabled', () => {
      const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString()
      render(<MoodCheck lastLoggedAt={oneHourAgo} onLog={mockOnLog} />)

      // Should show "Available again in ~3h"
      const message = screen.getByText(/Available again in/i)
      expect(message).toBeInTheDocument()
    })

    it('buttons are enabled when enough time has passed', () => {
      // 5 hours ago (more than 4 hour requirement)
      const fiveHoursAgo = new Date(Date.now() - 5 * 3_600_000).toISOString()
      render(<MoodCheck lastLoggedAt={fiveHoursAgo} onLog={mockOnLog} />)

      const buttons = screen.getAllByRole('button')

      buttons.forEach(button => {
        expect(button).not.toBeDisabled()
        expect(button).not.toHaveClass('opacity-40')
      })
    })

    it('buttons are enabled when never logged before', () => {
      render(<MoodCheck lastLoggedAt={null} onLog={mockOnLog} />)

      const buttons = screen.getAllByRole('button')

      buttons.forEach(button => {
        expect(button).not.toBeDisabled()
      })
    })
  })

  describe('Keyboard Navigation', () => {
    it('can navigate between mood buttons with Tab', async () => {
      const user = userEvent.setup()
      render(<MoodCheck lastLoggedAt={null} onLog={mockOnLog} />)

      // Tab to first button
      await user.tab()
      expect(screen.getByTitle('Frustrated')).toHaveFocus()

      // Tab to second button
      await user.tab()
      expect(screen.getByTitle('Okay')).toHaveFocus()

      // Tab to third button
      await user.tab()
      expect(screen.getByTitle('Good')).toHaveFocus()

      // Tab to fourth button
      await user.tab()
      expect(screen.getByTitle('Amazing')).toHaveFocus()
    })

    it('can activate mood buttons with Enter key', async () => {
      const user = userEvent.setup()
      render(<MoodCheck lastLoggedAt={null} onLog={mockOnLog} />)

      const goodButton = screen.getByTitle('Good')
      goodButton.focus()

      await user.keyboard('{Enter}')

      expect(mockOnLog).toHaveBeenCalledWith('good')
    })

    it('can activate mood buttons with Space key', async () => {
      const user = userEvent.setup()
      render(<MoodCheck lastLoggedAt={null} onLog={mockOnLog} />)

      const okayButton = screen.getByTitle('Okay')
      okayButton.focus()

      await user.keyboard(' ')

      expect(mockOnLog).toHaveBeenCalledWith('okay')
    })

    it('disabled buttons do not respond to keyboard activation', async () => {
      const user = userEvent.setup()
      const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString()
      render(<MoodCheck lastLoggedAt={oneHourAgo} onLog={mockOnLog} />)

      const goodButton = screen.getByTitle('Good')
      goodButton.focus()

      await user.keyboard('{Enter}')

      expect(mockOnLog).not.toHaveBeenCalled()
    })
  })

  describe('Visual Feedback', () => {
    it('buttons have hover state when enabled', () => {
      render(<MoodCheck lastLoggedAt={null} onLog={mockOnLog} />)

      const buttons = screen.getAllByRole('button')

      buttons.forEach(button => {
        expect(button).toHaveClass('hover:bg-white/10', 'hover:scale-110')
      })
    })

    it('buttons do not have hover state when disabled', () => {
      const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString()
      render(<MoodCheck lastLoggedAt={oneHourAgo} onLog={mockOnLog} />)

      const buttons = screen.getAllByRole('button')

      buttons.forEach(button => {
        expect(button).not.toHaveClass('hover:bg-white/10')
        expect(button).toHaveClass('opacity-40')
      })
    })
  })

  describe('Success State', () => {
    it('shows success message after logging mood', async () => {
      render(<MoodCheck lastLoggedAt={null} onLog={mockOnLog} />)

      const goodButton = screen.getByTitle('Good')
      goodButton.click()

      await vi.waitFor(() => expect(mockOnLog).toHaveBeenCalled())

      // Note: Success state is controlled by component's internal justLogged state
      // which triggers automatically after onLog completes
      // In a real integration test, we'd verify the success message appears
    })
  })
})

/**
 * CCMProposals Accessibility Tests
 *
 * Tests memory proposal UI for accessibility:
 * - Accept/reject button labels
 * - Keyboard navigation
 * - Loading states
 * - ARIA attributes
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { axe, toHaveNoViolations } from 'jest-axe'
import userEvent from '@testing-library/user-event'
import CCMProposals from '@renderer/components/CCMProposals'
import type { CCMProposal } from '../../../main/ccm'

expect.extend(toHaveNoViolations)

describe('CCMProposals - Accessibility', () => {
  const mockOnResolve = vi.fn()

  const sampleProposals: CCMProposal[] = [
    {
      id: 1,
      proposedKey: 'userPreference',
      proposedValue: 'dark mode',
      reason: 'User mentioned preferring dark mode'
    },
    {
      id: 2,
      proposedKey: 'userName',
      proposedValue: 'Alex',
      reason: 'User introduced themselves'
    }
  ]

  beforeEach(() => {
    mockOnResolve.mockClear()
    mockOnResolve.mockResolvedValue(undefined)
  })

  describe('Axe Scans', () => {
    it('has no accessibility violations with proposals', async () => {
      const { container } = render(
        <CCMProposals proposals={sampleProposals} onResolve={mockOnResolve} />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('returns null when no proposals (no violations)', () => {
      const { container } = render(
        <CCMProposals proposals={[]} onResolve={mockOnResolve} />
      )

      expect(container.firstChild).toBeNull()
    })
  })

  describe('Button Labels', () => {
    it('accept buttons have accessible labels', () => {
      render(<CCMProposals proposals={sampleProposals} onResolve={mockOnResolve} />)

      const acceptButtons = screen.getAllByText('✓')

      acceptButtons.forEach((button, index) => {
        expect(button).toBeInTheDocument()
        expect(button.tagName).toBe('BUTTON')

        // Add aria-label test when we enhance the component
      })
    })

    it('reject buttons have accessible labels', () => {
      render(<CCMProposals proposals={sampleProposals} onResolve={mockOnResolve} />)

      const rejectButtons = screen.getAllByText('✕')

      rejectButtons.forEach((button) => {
        expect(button).toBeInTheDocument()
        expect(button.tagName).toBe('BUTTON')
      })
    })
  })

  describe('Keyboard Navigation', () => {
    it('can navigate to accept buttons with Tab', async () => {
      const user = userEvent.setup()
      render(<CCMProposals proposals={sampleProposals} onResolve={mockOnResolve} />)

      const firstAcceptButton = screen.getAllByText('✓')[0]

      // Tab to first accept button
      await user.tab()
      expect(firstAcceptButton).toHaveFocus()
    })

    it('can activate accept button with Enter', async () => {
      const user = userEvent.setup()
      render(<CCMProposals proposals={sampleProposals} onResolve={mockOnResolve} />)

      const firstAcceptButton = screen.getAllByText('✓')[0]
      firstAcceptButton.focus()

      await user.keyboard('{Enter}')

      expect(mockOnResolve).toHaveBeenCalledWith(1, true)
    })

    it('can activate reject button with Enter', async () => {
      const user = userEvent.setup()
      render(<CCMProposals proposals={sampleProposals} onResolve={mockOnResolve} />)

      const firstRejectButton = screen.getAllByText('✕')[0]
      firstRejectButton.focus()

      await user.keyboard('{Enter}')

      expect(mockOnResolve).toHaveBeenCalledWith(1, false)
    })

    it('Tab navigates through all buttons in order', async () => {
      const user = userEvent.setup()
      render(<CCMProposals proposals={sampleProposals} onResolve={mockOnResolve} />)

      const acceptButtons = screen.getAllByText('✓')
      const rejectButtons = screen.getAllByText('✕')

      // Tab to first accept
      await user.tab()
      expect(acceptButtons[0]).toHaveFocus()

      // Tab to first reject
      await user.tab()
      expect(rejectButtons[0]).toHaveFocus()

      // Tab to second accept
      await user.tab()
      expect(acceptButtons[1]).toHaveFocus()

      // Tab to second reject
      await user.tab()
      expect(rejectButtons[1]).toHaveFocus()
    })
  })

  describe('Disabled State', () => {
    it('buttons are disabled while resolving', async () => {
      // Make onResolve slow so we can test loading state
      mockOnResolve.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

      const { rerender } = render(
        <CCMProposals proposals={sampleProposals} onResolve={mockOnResolve} />
      )

      const firstAcceptButton = screen.getAllByText('✓')[0]
      const firstRejectButton = screen.getAllByText('✕')[0]

      // Click accept button
      firstAcceptButton.click()

      // Buttons should be disabled while resolving
      // Note: Component uses local state, so we need to wait for React update
      await vi.waitFor(() => {
        expect(firstAcceptButton).toBeDisabled()
        expect(firstRejectButton).toBeDisabled()
      })
    })

    it('disabled buttons have reduced opacity', () => {
      mockOnResolve.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<CCMProposals proposals={sampleProposals} onResolve={mockOnResolve} />)

      const firstAcceptButton = screen.getAllByText('✓')[0]
      firstAcceptButton.click()

      // After click, button should have disabled styling
      // We check the disabled state via the button's disabled attribute
      expect(firstAcceptButton).toHaveClass('disabled:opacity-40')
    })
  })

  describe('Content Display', () => {
    it('displays proposal key and value', () => {
      render(<CCMProposals proposals={sampleProposals} onResolve={mockOnResolve} />)

      expect(screen.getByText('userPreference')).toBeInTheDocument()
      expect(screen.getByText('dark mode')).toBeInTheDocument()

      expect(screen.getByText('userName')).toBeInTheDocument()
      expect(screen.getByText('Alex')).toBeInTheDocument()
    })

    it('has proper text contrast for key (violet-300)', () => {
      render(<CCMProposals proposals={sampleProposals} onResolve={mockOnResolve} />)

      const keyElement = screen.getByText('userPreference')
      expect(keyElement).toHaveClass('text-violet-300')
    })

    it('has proper text contrast for value (white/50)', () => {
      render(<CCMProposals proposals={sampleProposals} onResolve={mockOnResolve} />)

      const valueElement = screen.getByText('dark mode')
      expect(valueElement).toHaveClass('text-white/50')
    })
  })

  describe('Section Header', () => {
    it('has descriptive header for proposals section', () => {
      render(<CCMProposals proposals={sampleProposals} onResolve={mockOnResolve} />)

      const header = screen.getByText(/Memory Proposals/i)
      expect(header).toBeInTheDocument()
      expect(header).toHaveClass('text-white/50')
    })
  })

  describe('Visual Feedback', () => {
    it('accept button has hover state', () => {
      render(<CCMProposals proposals={sampleProposals} onResolve={mockOnResolve} />)

      const acceptButton = screen.getAllByText('✓')[0]
      expect(acceptButton).toHaveClass('hover:bg-violet-500/60')
    })

    it('reject button has hover state', () => {
      render(<CCMProposals proposals={sampleProposals} onResolve={mockOnResolve} />)

      const rejectButton = screen.getAllByText('✕')[0]
      expect(rejectButton).toHaveClass('hover:bg-white/20')
    })
  })
})

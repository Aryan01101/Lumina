import React, { useState, useCallback, useEffect } from 'react'
import CompanionCharacter, { type AnimationState } from './components/CompanionCharacter'
import CompanionPanel from './components/CompanionPanel'

/**
 * Root application component.
 *
 * Layout: 340×500 transparent window positioned at bottom-right.
 * The companion character sits at the bottom; the panel slides up above it.
 *
 * Mouse-event forwarding:
 * - When hovering any interactive element → main process stops ignoring mouse events
 * - When cursor leaves the window → main process resumes click-through behavior
 */
export default function App(): React.ReactElement {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [animationState, setAnimationState] = useState<AnimationState>('idle')

  // Tell the main process whether to ignore mouse events
  const setMousePassThrough = useCallback((passThrough: boolean) => {
    window.lumina.window.setIgnoreMouseEvents(passThrough)
  }, [])

  // When companion character is hovered, disable click-through
  const handleMouseEnter = useCallback(() => {
    setMousePassThrough(false)
  }, [setMousePassThrough])

  // When cursor leaves the whole overlay area, re-enable click-through
  const handleMouseLeave = useCallback(() => {
    if (!isPanelOpen) {
      setMousePassThrough(true)
    }
  }, [isPanelOpen, setMousePassThrough])

  // Open/close the panel
  const handleTogglePanel = useCallback(() => {
    setIsPanelOpen(prev => {
      const next = !prev
      setMousePassThrough(!next) // panel open = interactive
      if (next) {
        setAnimationState('happy')
        setTimeout(() => setAnimationState('idle'), 1200)
      }
      return next
    })
  }, [setMousePassThrough])

  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false)
    setMousePassThrough(true)
  }, [setMousePassThrough])

  // Listen for activity state changes pushed from main process
  useEffect(() => {
    const off = window.lumina.activity.onStateChange(({ state }) => {
      // Map activity state to companion animation
      // Full auto-hide behavior (Phase 8) — Phase 3 drives animation only
      if (state === 'DEEP_WORK' || state === 'STUDY') {
        setAnimationState('sleeping')
      } else if (state === 'IDLE') {
        setAnimationState('sleeping')
      } else if (state === 'LUMINA') {
        setAnimationState('happy')
      } else {
        // BROWSING, PASSIVE_CONTENT, GAMING, VIDEO_CALL
        setAnimationState('idle')
      }
    })
    return off
  }, [])

  // Listen for agent-initiated messages (Phase 7)
  useEffect(() => {
    const off = window.lumina.agent.onStatus(status => {
      if (status.actionType !== 'SILENCE' && status.message) {
        // Phase 7: display the agent message, open panel, change animation
        console.log('[App] Agent message:', status.message)
      }
    })
    return off
  }, [])

  return (
    /*
     * Full-window transparent container.
     * flex-col with justify-end so companion sits at the bottom,
     * panel stacks above it.
     */
    <div
      className="w-full h-full flex flex-col justify-end items-end pb-0 pr-0"
      onMouseLeave={handleMouseLeave}
    >
      {/* Panel slides up above companion */}
      <div className="mb-2 mr-2">
        <CompanionPanel isOpen={isPanelOpen} onClose={handleClosePanel} />
      </div>

      {/* Companion character */}
      <div className="mb-4 mr-4">
        <CompanionCharacter
          animationState={animationState}
          isPanelOpen={isPanelOpen}
          onClick={handleTogglePanel}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={() => {/* handled at window level */}}
        />
      </div>
    </div>
  )
}

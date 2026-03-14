/**
 * Root App — Phase 8
 *
 * - Mouse capture is state-driven: a single useEffect watches all interactive
 *   state flags and calls setIgnoreMouseEvents accordingly. This prevents
 *   gaps where early-return modals (Onboarding) or future overlays would
 *   accidentally remain in click-through mode.
 * - Activity state → animation + auto-hide (opacity 0 for blocking states)
 * - Agent message bubble display
 * - Keyboard shortcut listener (Cmd/Ctrl+Shift+L)
 * - Settings panel toggle
 */
import React, { useState, useCallback, useEffect } from 'react'
import CompanionCharacter, { type AnimationState } from './components/CompanionCharacter'
import CompanionPanel from './components/CompanionPanel'
import AgentBubble from './components/AgentBubble'
import Settings from './components/Settings'
import Onboarding from './components/Onboarding'
import { shouldAutoHide } from './utils/autoHide'
import { mapActionTypeToAnimation } from './utils/format'

interface AgentMessage {
  actionType: string
  message: string
}

export default function App(): React.ReactElement {
  const [isPanelOpen, setIsPanelOpen]       = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [animationState, setAnimationState] = useState<AnimationState>('idle')
  const [isHidden, setIsHidden]             = useState(false)
  const [agentMsg, setAgentMsg]             = useState<AgentMessage | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isHovering, setIsHovering]         = useState(false)

  useEffect(() => {
    window.lumina.settings.get().then(({ settings }) => {
      const s = settings as { onboardingComplete?: boolean }
      if (!s.onboardingComplete) setShowOnboarding(true)
    })
  }, [])

  // ─── State-driven mouse capture ───────────────────────────────────────────
  // The window starts in click-through mode (setIgnoreMouseEvents true).
  // We capture the mouse whenever ANY interactive surface is visible.
  // One effect, no gaps — works for early-return modals, panels, hovering.
  const shouldCaptureMouse =
    showOnboarding ||
    isPanelOpen    ||
    isSettingsOpen ||
    agentMsg !== null ||
    isHovering

  useEffect(() => {
    window.lumina.window.setIgnoreMouseEvents(!shouldCaptureMouse)
  }, [shouldCaptureMouse])

  const handleMouseEnter = useCallback(() => setIsHovering(true), [])
  const handleMouseLeave = useCallback(() => setIsHovering(false), [])

  const handleTogglePanel = useCallback(() => {
    if (isSettingsOpen) {
      setIsSettingsOpen(false)
      return
    }
    setIsPanelOpen(prev => {
      const next = !prev
      if (next) {
        setAnimationState('happy')
        setTimeout(() => setAnimationState('idle'), 1200)
      }
      return next
    })
  }, [isSettingsOpen])

  const handleClosePanel    = useCallback(() => setIsPanelOpen(false), [])
  const handleCloseSettings = useCallback(() => setIsSettingsOpen(false), [])

  // ─── Activity state changes ───────────────────────────────────────────────

  useEffect(() => {
    const off = window.lumina.activity.onStateChange(({ state }) => {
      const hide = shouldAutoHide(state)
      setIsHidden(hide)

      if (hide) {
        setIsPanelOpen(false)
        setAnimationState('sleeping')
      } else if (state === 'LUMINA') {
        setAnimationState('happy')
      } else if (state === 'IDLE') {
        setAnimationState('sleeping')
      } else {
        setAnimationState('idle')
      }
    })
    return off
  }, [])

  // ─── Agent messages ───────────────────────────────────────────────────────

  useEffect(() => {
    const off = window.lumina.agent.onStatus(status => {
      if (status.actionType !== 'SILENCE' && status.message) {
        setAgentMsg({ actionType: status.actionType, message: status.message })
        setAnimationState(mapActionTypeToAnimation(status.actionType))
        setIsPanelOpen(true)
      }
    })
    return off
  }, [])

  // ─── Keyboard shortcut ─────────────────────────────────────────────────────

  useEffect(() => {
    const off = window.lumina.window.onTogglePanel(() => {
      if (isHidden) return
      setIsPanelOpen(prev => !prev)
    })
    return off
  }, [isHidden])

  if (isHidden) {
    return <div className="w-full h-full pointer-events-none" />
  }

  if (showOnboarding) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />
  }

  return (
    <div
      className="w-full h-full flex flex-col justify-end items-end pb-0 pr-0"
      onMouseLeave={handleMouseLeave}
    >
      {/* Settings panel */}
      {isSettingsOpen && (
        <div className="mb-2 mr-2" onMouseEnter={handleMouseEnter}>
          <Settings onClose={handleCloseSettings} />
        </div>
      )}

      {/* Companion panel — always mounted to preserve chat state */}
      <div className="mb-2 mr-2" onMouseEnter={handleMouseEnter}>
        <CompanionPanel isOpen={isPanelOpen && !isSettingsOpen} onClose={handleClosePanel} />
      </div>

      {/* Agent speech bubble */}
      {agentMsg && !isPanelOpen && (
        <div className="mr-2">
          <AgentBubble
            message={agentMsg.message}
            actionType={agentMsg.actionType}
            onDismiss={() => {
              setAgentMsg(null)
              setAnimationState('idle')
            }}
          />
        </div>
      )}

      {/* Companion character + settings gear */}
      <div
        className="mb-4 mr-4 flex items-center gap-2 group"
        onMouseEnter={handleMouseEnter}
      >
        <button
          onClick={() => {
            setIsSettingsOpen(prev => {
              if (!prev) setIsPanelOpen(false)
              return !prev
            })
          }}
          className="
            w-7 h-7 rounded-full bg-white/5 hover:bg-white/15
            flex items-center justify-center
            text-white/30 hover:text-white/70
            transition-all opacity-0 group-hover:opacity-100
          "
          aria-label="Settings"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <CompanionCharacter
          animationState={animationState}
          isPanelOpen={isPanelOpen}
          onClick={handleTogglePanel}
          onMouseEnter={() => {}}
          onMouseLeave={() => {}}
        />
      </div>
    </div>
  )
}

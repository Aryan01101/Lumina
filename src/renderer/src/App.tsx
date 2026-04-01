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
  const [isMinimized, setIsMinimized]       = useState(false)
  const [isCornerHover, setIsCornerHover]   = useState(false)
  const [sessionMinutes, setSessionMinutes] = useState(0)
  const [activityState, setActivityState]   = useState('BROWSING')
  const [activityMonitorEnabled, setActivityMonitorEnabled] = useState(true)

  useEffect(() => {
    window.lumina.settings.get().then(({ settings }) => {
      const s = settings as { onboardingComplete?: boolean; activityMonitorEnabled?: boolean }
      if (!s.onboardingComplete) setShowOnboarding(true)
      setActivityMonitorEnabled(s.activityMonitorEnabled ?? true)
    })
  }, [])

  // Poll session info and settings every 10 seconds
  useEffect(() => {
    const updateSessionInfo = async () => {
      try {
        const info = await window.lumina.activity.getCurrentSession()
        setSessionMinutes(info.sessionMinutes)
        setActivityState(info.activityState)

        // Also poll for settings changes (including monitor toggle)
        const { settings } = await window.lumina.settings.get()
        const s = settings as { activityMonitorEnabled?: boolean }
        setActivityMonitorEnabled(s.activityMonitorEnabled ?? true)
      } catch (err) {
        console.error('[App] Failed to get session info:', err)
      }
    }

    updateSessionInfo()
    const interval = setInterval(updateSessionInfo, 10_000)
    return () => clearInterval(interval)
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
    isHovering ||
    isCornerHover ||
    isMinimized

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
  const handleCloseSettings = useCallback(async () => {
    setIsSettingsOpen(false)
    // Immediately refresh settings to update monitor state and close/open eyes
    try {
      const { settings } = await window.lumina.settings.get()
      const s = settings as { activityMonitorEnabled?: boolean }
      setActivityMonitorEnabled(s.activityMonitorEnabled ?? true)
    } catch (err) {
      console.error('[App] Failed to refresh settings:', err)
    }
  }, [])
  const handleMinimize      = useCallback(() => {
    setIsMinimized(true)
    setIsPanelOpen(false)
    setIsSettingsOpen(false)
  }, [])
  const handleRestore       = useCallback(() => {
    setIsMinimized(false)
  }, [])

  // ─── Activity state changes ───────────────────────────────────────────────

  useEffect(() => {
    const off = window.lumina.activity.onStateChange(({ state }) => {
      // Don't update animation if monitor is disabled - keep eyes closed
      if (!activityMonitorEnabled) return

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
  }, [activityMonitorEnabled])

  // ─── Activity monitor toggle (close/open eyes) ────────────────────────────

  useEffect(() => {
    if (!activityMonitorEnabled) {
      // Close eyes when monitor is disabled
      setAnimationState('sleeping')
      console.log('[App] Activity monitor disabled - closing eyes')
    } else {
      // Open eyes when monitor is re-enabled - set to appropriate state
      if (isHidden || activityState === 'IDLE') {
        setAnimationState('sleeping')
      } else {
        setAnimationState('idle')
      }
      console.log('[App] Activity monitor enabled - opening eyes')
    }
  }, [activityMonitorEnabled, isHidden, activityState])

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

  // Minimized corner indicator
  if (isMinimized && !isCornerHover) {
    return (
      <div className="w-full h-full flex flex-col justify-end items-end pb-4 pr-4">
        <div
          onMouseEnter={() => setIsCornerHover(true)}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500/40 to-indigo-600/40
                     border-2 border-violet-400/60 cursor-pointer
                     flex items-center justify-center animate-pulse
                     hover:scale-110 transition-transform"
          onClick={handleRestore}
        >
          <div className="w-3 h-3 rounded-full bg-violet-400 animate-pulse" />
        </div>
      </div>
    )
  }

  // Restore from hover
  if (isMinimized && isCornerHover) {
    setTimeout(() => {
      setIsMinimized(false)
      setIsCornerHover(false)
    }, 200)
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
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
              transition-all
            "
            aria-label="Settings"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            onClick={handleMinimize}
            className="
              w-7 h-7 rounded-full bg-white/5 hover:bg-white/15
              flex items-center justify-center
              text-white/30 hover:text-white/70
              transition-all
            "
            title="Minimize to corner"
            aria-label="Minimize to corner"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <CompanionCharacter
          animationState={animationState}
          isPanelOpen={isPanelOpen}
          onClick={handleTogglePanel}
          onMouseEnter={() => {}}
          onMouseLeave={() => {}}
          sessionMinutes={sessionMinutes}
          activityState={activityState}
        />
      </div>
    </div>
  )
}

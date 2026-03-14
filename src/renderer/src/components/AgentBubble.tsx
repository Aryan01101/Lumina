/**
 * Agent Bubble — Phase 8
 *
 * Speech bubble that appears above the companion when the agent
 * proactively sends a CHECKIN, NUDGE, or CELEBRATE message.
 * Auto-dismisses after 8 seconds.
 */
import React, { useEffect, useState } from 'react'

interface Props {
  message: string
  actionType: string
  onDismiss: () => void
}

const ACTION_COLORS: Record<string, string> = {
  CELEBRATE: 'from-amber-500/20 to-yellow-500/20 border-amber-400/30',
  CHECKIN:   'from-violet-500/20 to-indigo-500/20 border-violet-400/30',
  NUDGE:     'from-blue-500/20 to-cyan-500/20 border-blue-400/30'
}

const AUTO_DISMISS_MS = 8_000

export default function AgentBubble({ message, actionType, onDismiss }: Props): React.ReactElement {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Animate in
    const showTimer = setTimeout(() => setVisible(true), 50)
    // Auto-dismiss
    const hideTimer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 300)
    }, AUTO_DISMISS_MS)
    return () => { clearTimeout(showTimer); clearTimeout(hideTimer) }
  }, [onDismiss])

  const colorClass = ACTION_COLORS[actionType] ?? ACTION_COLORS.CHECKIN

  return (
    <div
      className={`
        mb-2 mr-2 max-w-[280px]
        transition-all duration-300
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
      `}
    >
      <div
        className={`
          relative px-4 py-3 rounded-2xl rounded-br-sm text-sm leading-relaxed
          bg-gradient-to-br ${colorClass}
          border backdrop-blur-md
          text-white/90
        `}
        style={{ background: 'rgba(15, 10, 30, 0.88)' }}
      >
        {message}
        <button
          onClick={() => { setVisible(false); setTimeout(onDismiss, 300) }}
          className="absolute top-2 right-2 text-white/30 hover:text-white/60 text-xs leading-none transition-colors"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  )
}

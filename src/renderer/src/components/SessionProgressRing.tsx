/**
 * Session Progress Ring Component
 *
 * Displays a progress ring around the companion character showing
 * the current session duration. Different colors for different activity types.
 */
import React from 'react'

interface Props {
  sessionMinutes: number
  activityState: string
  maxMinutes?: number
}

const ACTIVITY_COLORS: Record<string, string> = {
  DEEP_WORK: '#8b5cf6',    // violet
  STUDY: '#10b981',        // green
  GAMING: '#f59e0b',       // amber
  VIDEO_CALL: '#3b82f6',   // blue
  PASSIVE_CONTENT: '#ec4899', // pink
  BROWSING: '#6b7280',     // gray
  IDLE: '#374151',         // dark gray
  LUMINA: '#a78bfa'        // light violet
}

export default function SessionProgressRing({
  sessionMinutes,
  activityState,
  maxMinutes = 60
}: Props): React.ReactElement | null {
  // Don't show ring if no active session
  if (sessionMinutes <= 0) return null

  const progress = Math.min(sessionMinutes / maxMinutes, 1)
  const color = ACTIVITY_COLORS[activityState] || ACTIVITY_COLORS.BROWSING

  // SVG circle properties
  const size = 120
  const strokeWidth = 3
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - progress)

  return (
    <svg
      width={size}
      height={size}
      className="absolute inset-0 pointer-events-none"
      style={{ transform: 'rotate(-90deg)' }}
    >
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth={strokeWidth}
      />

      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{
          transition: 'stroke-dashoffset 0.5s ease',
          filter: 'drop-shadow(0 0 4px rgba(139, 92, 246, 0.5))'
        }}
      />
    </svg>
  )
}

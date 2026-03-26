import React from 'react'
import SessionProgressRing from './SessionProgressRing'

export type AnimationState = 'idle' | 'happy' | 'thinking' | 'concerned' | 'celebrating' | 'sleeping'

interface Props {
  animationState: AnimationState
  isPanelOpen: boolean
  onClick: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
  sessionMinutes?: number
  activityState?: string
}

const animationClass: Record<AnimationState, string> = {
  idle: 'animate-float',
  happy: 'animate-bounce-soft',
  thinking: 'animate-pulse-soft',
  concerned: 'animate-sway',
  celebrating: 'animate-bounce',
  sleeping: 'animate-breathe'
}

const eyeClass: Record<AnimationState, string> = {
  idle: '',
  happy: 'scale-y-50',        // squinting eyes
  thinking: 'opacity-50',     // half-closed
  concerned: 'scale-y-75',    // slightly narrowed
  celebrating: 'scale-125',   // wide eyes
  sleeping: 'scale-y-0'       // closed eyes
}

export default function CompanionCharacter({
  animationState,
  isPanelOpen,
  onClick,
  onMouseEnter,
  onMouseLeave,
  sessionMinutes = 0,
  activityState = 'BROWSING'
}: Props): React.ReactElement {
  const isSleeping = animationState === 'sleeping'

  return (
    <div className="relative">
      {/* Session Progress Ring */}
      <SessionProgressRing
        sessionMinutes={sessionMinutes}
        activityState={activityState}
      />

      <button
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`
          relative flex items-center justify-center
          w-24 h-24 rounded-full cursor-pointer
          bg-gradient-to-br from-violet-500 to-indigo-600
          shadow-lg shadow-violet-500/40
          border-2 transition-all duration-300
          focus:outline-none
          ${isPanelOpen
            ? 'border-violet-300/60 shadow-violet-400/60 w-16 h-16'
            : 'border-transparent hover:border-violet-300/40 hover:shadow-violet-500/50'}
          ${animationClass[animationState]}
        `}
        aria-label="Open Lumina companion panel"
      >
        {/* Glow ring */}
        <div className="absolute inset-0 rounded-full bg-violet-400/10 blur-sm" />

      {/* Face */}
      <div className="relative flex flex-col items-center gap-1">
        {/* Eyes */}
        <div className="flex gap-2.5">
          <div
            className={`
              w-3.5 h-3.5 rounded-full bg-white
              flex items-center justify-center
              transition-transform duration-300
              ${eyeClass[animationState]}
            `}
          >
            {!isSleeping && (
              <div className="w-2 h-2 rounded-full bg-gray-800 translate-x-px" />
            )}
            {isSleeping && (
              <div className="w-3 h-0.5 rounded-full bg-gray-400" />
            )}
          </div>
          <div
            className={`
              w-3.5 h-3.5 rounded-full bg-white
              flex items-center justify-center
              transition-transform duration-300
              ${eyeClass[animationState]}
            `}
          >
            {!isSleeping && (
              <div className="w-2 h-2 rounded-full bg-gray-800 translate-x-px" />
            )}
            {isSleeping && (
              <div className="w-3 h-0.5 rounded-full bg-gray-400" />
            )}
          </div>
        </div>

        {/* Mouth */}
        <div className={`
          w-4 h-1.5 rounded-full
          transition-all duration-300
          ${animationState === 'happy' || animationState === 'celebrating'
            ? 'bg-white scale-110'
            : animationState === 'concerned'
              ? 'bg-white/60 rotate-180 scale-75'
              : 'bg-white/70 scale-90'
          }
        `} />
      </div>

        {/* Thinking dots overlay */}
        {animationState === 'thinking' && (
          <div className="absolute -top-1 -right-1 flex gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-200 animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-violet-200 animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-violet-200 animate-bounce [animation-delay:300ms]" />
          </div>
        )}
      </button>
    </div>
  )
}

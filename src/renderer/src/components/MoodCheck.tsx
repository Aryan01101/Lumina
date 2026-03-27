/**
 * Mood Vibe Check — Phase 8
 *
 * 4-emoji mood logger with 4-hour rate limiting.
 * Shows last logged time when not available.
 */
import React, { useState } from 'react'
import { MOOD_OPTIONS, canLogMood } from '../utils/mood'

interface Props {
  lastLoggedAt: string | null
  onLog: (value: 'frustrated' | 'okay' | 'good' | 'amazing') => Promise<void>
}

export default function MoodCheck({ lastLoggedAt, onLog }: Props): React.ReactElement {
  const [loading, setLoading] = useState(false)
  const [justLogged, setJustLogged] = useState(false)
  const now = new Date().toISOString()
  const canLog = canLogMood(lastLoggedAt, now)

  const handleLog = async (value: 'frustrated' | 'okay' | 'good' | 'amazing') => {
    if (!canLog || loading) return
    setLoading(true)
    try {
      await onLog(value)
      setJustLogged(true)
      setTimeout(() => setJustLogged(false), 2000)
    } finally {
      setLoading(false)
    }
  }

  if (justLogged) {
    return (
      <div className="flex flex-col items-center gap-2 py-4" role="status" aria-live="polite">
        <span className="text-2xl">✓</span>
        <p className="text-white/60 text-xs">Logged. Thanks!</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 py-2">
      <p className="text-white/50 text-xs text-center">How are you feeling right now?</p>
      <div className="flex justify-center gap-3">
        {MOOD_OPTIONS.map(({ value, emoji, label }) => (
          <button
            key={value}
            onClick={() => handleLog(value)}
            disabled={!canLog || loading}
            title={label}
            aria-label={`Log mood as ${label}`}
            className={`
              flex flex-col items-center gap-1 p-2 rounded-xl
              transition-all duration-150
              ${canLog && !loading
                ? 'hover:bg-white/10 hover:scale-110 active:scale-95 cursor-pointer'
                : 'opacity-40 cursor-not-allowed'
              }
            `}
          >
            <span className="text-xl">{emoji}</span>
            <span className="text-white/40 text-[10px]">{label}</span>
          </button>
        ))}
      </div>
      {!canLog && lastLoggedAt && (
        <p className="text-white/35 text-[10px] text-center">
          Available again in ~{Math.ceil((4 - (Date.now() - new Date(lastLoggedAt).getTime()) / 3_600_000))}h
        </p>
      )}
    </div>
  )
}

/**
 * Mood utility functions — Phase 8
 */

export const MOOD_RATE_LIMIT_MS = 4 * 60 * 60 * 1000  // 4 hours

export interface MoodOption {
  value: 'frustrated' | 'okay' | 'good' | 'amazing'
  emoji: string
  label: string
}

export const MOOD_OPTIONS: MoodOption[] = [
  { value: 'frustrated', emoji: '😤', label: 'Frustrated' },
  { value: 'okay',       emoji: '😐', label: 'Okay' },
  { value: 'good',       emoji: '🙂', label: 'Good' },
  { value: 'amazing',    emoji: '🤩', label: 'Amazing' }
]

/**
 * Returns true if the user is allowed to log a mood right now.
 * Rate limit: once per 4 hours.
 */
export function canLogMood(lastLoggedAt: string | null, now: string): boolean {
  if (!lastLoggedAt) return true
  const elapsed = new Date(now).getTime() - new Date(lastLoggedAt).getTime()
  return elapsed > MOOD_RATE_LIMIT_MS
}

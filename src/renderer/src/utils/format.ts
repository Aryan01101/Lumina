/**
 * Display formatting utilities — Phase 8
 */

import type { AnimationState } from '../components/CompanionCharacter'

/**
 * Formats a groundedness score (0–1) as a percentage string.
 * Returns null when score is null.
 */
export function formatGroundednessScore(score: number | null): string | null {
  if (score === null) return null
  return `${Math.round(score * 100)}%`
}

/**
 * Maps an agent ActionType to the appropriate companion AnimationState.
 */
export function mapActionTypeToAnimation(actionType: string): AnimationState {
  switch (actionType) {
    case 'CELEBRATE': return 'celebrating'
    case 'CHECKIN':   return 'happy'
    case 'NUDGE':     return 'concerned'
    default:          return 'idle'
  }
}

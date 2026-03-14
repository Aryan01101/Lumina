/**
 * Auto-hide utility — Phase 8
 *
 * Determines whether the companion should fade out based on activity state.
 * PRD F-02: Auto-hide during DEEP_WORK, STUDY, GAMING, VIDEO_CALL.
 */

const AUTO_HIDE_STATES = new Set([
  'DEEP_WORK',
  'STUDY',
  'GAMING',
  'VIDEO_CALL'
])

/**
 * Returns true if the companion overlay should auto-hide for this activity state.
 */
export function shouldAutoHide(activityState: string): boolean {
  return AUTO_HIDE_STATES.has(activityState)
}

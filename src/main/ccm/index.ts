/**
 * Companion Core Memory (CCM) — Phase 5
 *
 * Manages the living structured document describing who the user is.
 * Sections: user_facts, user_patterns, relationship_notes, tone_calibration.
 *
 * Responsibilities:
 *   - Read/write CCM from companion_core_memory table
 *   - Generate compressed 250-300 token CCM summary for prompt injection
 *   - Cache summary, regenerate only on CCM change
 *   - Manage ccm_proposals (extract facts → propose → user accepts/rejects)
 *   - Retain last 5 CCM states for rollback
 *
 * All logic is stubbed until Phase 5.
 */

export interface CCMData {
  userFacts: Record<string, unknown>
  userPatterns: Record<string, unknown>
  relationshipNotes: Record<string, unknown>
  toneCalibration: {
    formal_casual: number
    directness: number
    humour: number
    checkin_frequency: 'relaxed' | 'normal' | 'active'
  }
}

export interface CCMProposal {
  id: number
  section: keyof CCMData
  proposedKey: string
  proposedValue: unknown
  status: 'pending' | 'accepted' | 'rejected'
}

// Phase 5: read CCM from DB
export function getCCM(): CCMData {
  return {
    userFacts: {},
    userPatterns: {},
    relationshipNotes: {},
    toneCalibration: { formal_casual: 3, directness: 3, humour: 2, checkin_frequency: 'normal' }
  }
}

// Phase 5: generate compressed summary for prompt injection
export function getCCMSummary(): string {
  return '' // Empty until Phase 5
}

// Phase 5: get pending proposals
export function getPendingProposals(): CCMProposal[] {
  return []
}

// Phase 5: accept or reject a proposal
export function resolveProposal(_id: number, _accept: boolean): void {
  console.log('[CCM] Proposal resolution placeholder — Phase 5 implementation pending')
}

/**
 * Companion Core Memory (CCM) — Phase 5
 *
 * Manages the living structured document describing who the user is.
 * Sections: user_facts, user_patterns, relationship_notes, tone_calibration.
 *
 * All pure functions take `db` as first parameter for testability.
 * IPC handlers call these by passing getDb().
 *
 * Responsibilities:
 *   - Read/write CCM from companion_core_memory table
 *   - Generate compressed 250-300 token CCM summary for prompt injection
 *   - Manage ccm_proposals (propose → user accepts/rejects)
 *   - Retain last 5 CCM version snapshots for rollback
 */

import Database from 'better-sqlite3'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface CCMData {
  userFacts: Record<string, unknown>
  userPatterns: Record<string, unknown>
  relationshipNotes: Record<string, unknown>
  toneCalibration: {
    formal_casual: number               // 1–5
    directness: number                  // 1–5
    humour: number                      // 1–5
    checkin_frequency: 'relaxed' | 'normal' | 'active'
  }
  version: number
  lastUpdatedAt: string
}

export interface CCMProposal {
  id: number
  section: keyof CCMData
  proposedKey: string
  proposedValue: unknown
  sourceMessageId: number | null
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: string
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface CCMRow {
  id: number
  user_facts: string
  user_patterns: string
  relationship_notes: string
  tone_calibration: string
  last_updated_at: string
  version: number
  previous_versions: string
}

interface PreviousVersionEntry {
  version: number
  section: keyof CCMData
  snapshot: Record<string, unknown>
  changed_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_SECTIONS = new Set([
  'user_facts',
  'user_patterns',
  'relationship_notes',
  'tone_calibration'
])

const SECTION_TO_FIELD: Record<string, keyof CCMData> = {
  user_facts:         'userFacts',
  user_patterns:      'userPatterns',
  relationship_notes: 'relationshipNotes',
  tone_calibration:   'toneCalibration'
}

// ─── getCCM ───────────────────────────────────────────────────────────────────

export function getCCM(db: Database.Database): CCMData | null {
  const row = db
    .prepare('SELECT * FROM companion_core_memory WHERE id = 1')
    .get() as CCMRow | undefined

  if (!row) return null

  return {
    userFacts:         JSON.parse(row.user_facts),
    userPatterns:      JSON.parse(row.user_patterns),
    relationshipNotes: JSON.parse(row.relationship_notes),
    toneCalibration:   JSON.parse(row.tone_calibration),
    version:           row.version,
    lastUpdatedAt:     row.last_updated_at
  }
}

// ─── getCCMSummary ────────────────────────────────────────────────────────────

const DEFAULT_TONE_CALIBRATION = {
  formal_casual: 3,
  directness: 3,
  humour: 2,
  checkin_frequency: 'normal'
}

export function getCCMSummary(db: Database.Database): string {
  const ccm = getCCM(db)
  if (!ccm) return ''

  const factsEmpty    = Object.keys(ccm.userFacts).length === 0
  const patternsEmpty = Object.keys(ccm.userPatterns).length === 0
  const notesEmpty    = Object.keys(ccm.relationshipNotes).length === 0
  const t = ccm.toneCalibration
  const toneIsDefault =
    t.formal_casual      === DEFAULT_TONE_CALIBRATION.formal_casual &&
    t.directness         === DEFAULT_TONE_CALIBRATION.directness &&
    t.humour             === DEFAULT_TONE_CALIBRATION.humour &&
    t.checkin_frequency  === DEFAULT_TONE_CALIBRATION.checkin_frequency

  if (factsEmpty && patternsEmpty && notesEmpty && toneIsDefault) return ''

  const lines: string[] = ['[User Context]']

  if (!factsEmpty) {
    lines.push('Facts:')
    for (const [k, v] of Object.entries(ccm.userFacts)) {
      lines.push(`  ${k}: ${String(v)}`)
    }
  }

  if (!patternsEmpty) {
    lines.push('Patterns:')
    for (const [k, v] of Object.entries(ccm.userPatterns)) {
      lines.push(`  ${k}: ${String(v)}`)
    }
  }

  if (!notesEmpty) {
    lines.push('Relationship notes:')
    for (const [k, v] of Object.entries(ccm.relationshipNotes)) {
      lines.push(`  ${k}: ${String(v)}`)
    }
  }

  if (!toneIsDefault) {
    lines.push(
      `Tone: formal_casual=${t.formal_casual}/5, directness=${t.directness}/5, ` +
      `humour=${t.humour}/5, checkin=${t.checkin_frequency}`
    )
  }

  return lines.join('\n')
}

// ─── getPendingProposals ──────────────────────────────────────────────────────

export function getPendingProposals(db: Database.Database): CCMProposal[] {
  const rows = db
    .prepare(`
      SELECT id, section, proposed_key, proposed_value,
             source_message_id, status, created_at
      FROM ccm_proposals
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `)
    .all() as Array<{
      id: number
      section: string
      proposed_key: string
      proposed_value: string
      source_message_id: number | null
      status: string
      created_at: string
    }>

  return rows.map(r => ({
    id:              r.id,
    section:         SECTION_TO_FIELD[r.section] as keyof CCMData,
    proposedKey:     r.proposed_key,
    proposedValue:   JSON.parse(r.proposed_value),
    sourceMessageId: r.source_message_id,
    status:          r.status as CCMProposal['status'],
    createdAt:       r.created_at
  }))
}

// ─── createProposal ───────────────────────────────────────────────────────────

export function createProposal(
  db: Database.Database,
  section: string,
  key: string,
  value: unknown,
  sourceMessageId?: number | null
): number {
  if (!VALID_SECTIONS.has(section)) {
    throw new Error(`Invalid CCM section: ${section}`)
  }

  const result = db
    .prepare(`
      INSERT INTO ccm_proposals (section, proposed_key, proposed_value, source_message_id)
      VALUES (?, ?, ?, ?)
    `)
    .run(section, key, JSON.stringify(value), sourceMessageId ?? null)

  return result.lastInsertRowid as number
}

// ─── resolveProposal ──────────────────────────────────────────────────────────

export function resolveProposal(
  db: Database.Database,
  id: number,
  accept: boolean
): void {
  const proposal = db
    .prepare('SELECT * FROM ccm_proposals WHERE id = ?')
    .get(id) as {
      id: number
      section: string
      proposed_key: string
      proposed_value: string
      status: string
    } | undefined

  if (!proposal) {
    throw new Error(`Proposal not found: ${id}`)
  }

  if (proposal.status !== 'pending') {
    throw new Error(`Proposal already resolved: ${id}`)
  }

  if (!accept) {
    db.prepare("UPDATE ccm_proposals SET status = 'rejected' WHERE id = ?").run(id)
    return
  }

  // Accept path — transactional merge + version history
  const applyAccept = db.transaction(() => {
    const row = db
      .prepare('SELECT * FROM companion_core_memory WHERE id = 1')
      .get() as CCMRow

    const columnName = proposal.section
    const currentSection: Record<string, unknown> = JSON.parse(
      (row as unknown as Record<string, string>)[columnName]
    )

    // Build version snapshot and cap array at 5
    const prevVersions: PreviousVersionEntry[] = JSON.parse(row.previous_versions)
    const entry: PreviousVersionEntry = {
      version:    row.version,
      section:    SECTION_TO_FIELD[columnName] as keyof CCMData,
      snapshot:   { ...currentSection },
      changed_at: new Date().toISOString()
    }
    prevVersions.push(entry)
    if (prevVersions.length > 5) prevVersions.shift()

    // Merge proposed value into section
    const proposedValue = JSON.parse(proposal.proposed_value)
    currentSection[proposal.proposed_key] = proposedValue

    // columnName is from proposal.section which is validated by DB CHECK constraint —
    // template literal here is safe (whitelist-validated at insert time)
    db.prepare(`
      UPDATE companion_core_memory
      SET ${columnName}       = ?,
          version             = version + 1,
          previous_versions   = ?,
          last_updated_at     = datetime('now')
      WHERE id = 1
    `).run(JSON.stringify(currentSection), JSON.stringify(prevVersions))

    db.prepare("UPDATE ccm_proposals SET status = 'accepted' WHERE id = ?").run(id)
  })

  applyAccept()
}

// ─── updateCCMSection ─────────────────────────────────────────────────────────

/**
 * Direct section merge — bypasses the proposal flow.
 * Used by the settings panel (Phase 8) for tone calibration and manual edits.
 */
export function updateCCMSection(
  db: Database.Database,
  section: string,
  data: Record<string, unknown>
): void {
  if (!VALID_SECTIONS.has(section)) {
    throw new Error(`Invalid CCM section: ${section}`)
  }

  const update = db.transaction(() => {
    const row = db
      .prepare('SELECT * FROM companion_core_memory WHERE id = 1')
      .get() as CCMRow

    const columnName = section
    const currentSection: Record<string, unknown> = JSON.parse(
      (row as unknown as Record<string, string>)[columnName]
    )

    const prevVersions: PreviousVersionEntry[] = JSON.parse(row.previous_versions)
    const entry: PreviousVersionEntry = {
      version:    row.version,
      section:    SECTION_TO_FIELD[columnName] as keyof CCMData,
      snapshot:   { ...currentSection },
      changed_at: new Date().toISOString()
    }
    prevVersions.push(entry)
    if (prevVersions.length > 5) prevVersions.shift()

    const merged = { ...currentSection, ...data }

    db.prepare(`
      UPDATE companion_core_memory
      SET ${columnName}     = ?,
          version           = version + 1,
          previous_versions = ?,
          last_updated_at   = datetime('now')
      WHERE id = 1
    `).run(JSON.stringify(merged), JSON.stringify(prevVersions))
  })

  update()
}

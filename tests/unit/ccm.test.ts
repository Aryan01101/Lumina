import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../src/main/db/migrations'
import {
  getCCM,
  getCCMSummary,
  getPendingProposals,
  createProposal,
  resolveProposal,
  updateCCMSection
} from '../../src/main/ccm'

// ─── Test DB helper ─────────────────────────────────────────────────────────
// sqlite-vec not needed for CCM — no memory_vec operations
function openTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db, false)
  return db
}

let db: Database.Database

beforeEach(() => { db = openTestDb() })
afterEach(() => { db.close() })

// ─── getCCM ──────────────────────────────────────────────────────────────────
describe('getCCM', () => {
  it('returns non-null after migration (row seeded by migration)', () => {
    const result = getCCM(db)
    expect(result).not.toBeNull()
  })

  it('returns empty objects for userFacts, userPatterns, relationshipNotes', () => {
    const result = getCCM(db)!
    expect(result.userFacts).toEqual({})
    expect(result.userPatterns).toEqual({})
    expect(result.relationshipNotes).toEqual({})
  })

  it('returns seeded default toneCalibration values', () => {
    const result = getCCM(db)!
    expect(result.toneCalibration.formal_casual).toBe(3)
    expect(result.toneCalibration.directness).toBe(3)
    expect(result.toneCalibration.humour).toBe(2)
    expect(result.toneCalibration.checkin_frequency).toBe('normal')
  })

  it('returns null when row is deleted', () => {
    db.prepare('DELETE FROM companion_core_memory').run()
    expect(getCCM(db)).toBeNull()
  })

  it('reflects updated user_facts after direct SQL update', () => {
    db.prepare(
      `UPDATE companion_core_memory SET user_facts = '{"name":"Alice"}' WHERE id = 1`
    ).run()
    const result = getCCM(db)!
    expect(result.userFacts).toEqual({ name: 'Alice' })
  })
})

// ─── getCCMSummary ────────────────────────────────────────────────────────────
describe('getCCMSummary', () => {
  it('returns empty string when CCM has all default/empty values', () => {
    expect(getCCMSummary(db)).toBe('')
  })

  it('returns non-empty string after adding a user fact', () => {
    db.prepare(
      `UPDATE companion_core_memory SET user_facts = '{"occupation":"engineer"}' WHERE id = 1`
    ).run()
    expect(getCCMSummary(db)).not.toBe('')
  })

  it('summary contains [User Context] header when non-empty', () => {
    db.prepare(
      `UPDATE companion_core_memory SET user_facts = '{"role":"developer"}' WHERE id = 1`
    ).run()
    expect(getCCMSummary(db)).toContain('[User Context]')
  })

  it('summary contains Facts: section when userFacts is non-empty', () => {
    db.prepare(
      `UPDATE companion_core_memory SET user_facts = '{"age":28}' WHERE id = 1`
    ).run()
    expect(getCCMSummary(db)).toContain('Facts:')
  })

  it('summary contains Patterns: section when userPatterns is non-empty', () => {
    db.prepare(
      `UPDATE companion_core_memory SET user_patterns = '{"morning":"gym"}' WHERE id = 1`
    ).run()
    expect(getCCMSummary(db)).toContain('Patterns:')
  })

  it('summary stays under 1800 characters for a fully populated CCM', () => {
    db.prepare(`
      UPDATE companion_core_memory
      SET user_facts         = '{"name":"Alice","age":28,"occupation":"software engineer","city":"London","goal":"ship product"}',
          user_patterns      = '{"morning":"gym","evening":"reading","focus_hours":"09:00-12:00"}',
          relationship_notes = '{"trust_level":"high","prefers":"direct feedback"}',
          tone_calibration   = '{"formal_casual":2,"directness":4,"humour":3,"checkin_frequency":"active"}'
      WHERE id = 1
    `).run()
    expect(getCCMSummary(db).length).toBeLessThan(1800)
  })

  it('returns empty string when row is deleted', () => {
    db.prepare('DELETE FROM companion_core_memory').run()
    expect(getCCMSummary(db)).toBe('')
  })
})

// ─── getPendingProposals ──────────────────────────────────────────────────────
describe('getPendingProposals', () => {
  it('returns empty array when no proposals exist', () => {
    expect(getPendingProposals(db)).toEqual([])
  })

  it('returns only pending proposals, ignoring accepted and rejected', () => {
    db.prepare(`INSERT INTO ccm_proposals (section, proposed_key, proposed_value, status) VALUES ('user_facts','name','"Alice"','pending')`).run()
    db.prepare(`INSERT INTO ccm_proposals (section, proposed_key, proposed_value, status) VALUES ('user_patterns','morning','"gym"','accepted')`).run()
    db.prepare(`INSERT INTO ccm_proposals (section, proposed_key, proposed_value, status) VALUES ('relationship_notes','trust','"high"','rejected')`).run()

    const result = getPendingProposals(db)
    expect(result).toHaveLength(1)
    expect(result[0].proposedKey).toBe('name')
    expect(result[0].proposedValue).toBe('Alice')
    expect(result[0].status).toBe('pending')
  })

  it('maps DB snake_case section to camelCase CCMData key', () => {
    db.prepare(`INSERT INTO ccm_proposals (section, proposed_key, proposed_value) VALUES ('relationship_notes','key','"val"')`).run()
    const result = getPendingProposals(db)
    expect(result[0].section).toBe('relationshipNotes')
  })

  it('returns sourceMessageId as null when not set', () => {
    db.prepare(`INSERT INTO ccm_proposals (section, proposed_key, proposed_value) VALUES ('user_facts','k','"v"')`).run()
    expect(getPendingProposals(db)[0].sourceMessageId).toBeNull()
  })
})

// ─── createProposal ───────────────────────────────────────────────────────────
describe('createProposal', () => {
  it('returns a positive integer id', () => {
    const id = createProposal(db, 'user_facts', 'occupation', 'engineer')
    expect(typeof id).toBe('number')
    expect(id).toBeGreaterThan(0)
  })

  it('created proposal is retrievable as pending via getPendingProposals', () => {
    createProposal(db, 'user_patterns', 'morning_routine', 'coffee first')
    const proposals = getPendingProposals(db)
    expect(proposals).toHaveLength(1)
    expect(proposals[0].proposedKey).toBe('morning_routine')
    expect(proposals[0].proposedValue).toBe('coffee first')
    expect(proposals[0].status).toBe('pending')
  })

  it('serialises number value — proposedValue is parsed back as number', () => {
    createProposal(db, 'user_facts', 'age', 28)
    const proposal = getPendingProposals(db)[0]
    expect(proposal.proposedValue).toBe(28)
  })

  it('serialises string value correctly', () => {
    createProposal(db, 'user_facts', 'city', 'London')
    expect(getPendingProposals(db)[0].proposedValue).toBe('London')
  })

  it('throws Error for invalid section name', () => {
    expect(() =>
      createProposal(db, 'bad_section', 'key', 'value')
    ).toThrow('Invalid CCM section: bad_section')
  })

  it('stores null sourceMessageId when not provided', () => {
    createProposal(db, 'user_facts', 'k', 'v')
    expect(getPendingProposals(db)[0].sourceMessageId).toBeNull()
  })

  it('ids increment for each new proposal', () => {
    const id1 = createProposal(db, 'user_facts', 'k1', 'v1')
    const id2 = createProposal(db, 'user_facts', 'k2', 'v2')
    expect(id2).toBe(id1 + 1)
  })
})

// ─── resolveProposal — accept ─────────────────────────────────────────────────
describe('resolveProposal — accept', () => {
  it('merges proposed value into the correct CCM section', () => {
    const id = createProposal(db, 'user_facts', 'occupation', 'engineer')
    resolveProposal(db, id, true)
    expect(getCCM(db)!.userFacts['occupation']).toBe('engineer')
  })

  it('bumps version from 1 to 2 on first accept', () => {
    const id = createProposal(db, 'user_facts', 'name', 'Alice')
    resolveProposal(db, id, true)
    const row = db.prepare('SELECT version FROM companion_core_memory WHERE id = 1').get() as { version: number }
    expect(row.version).toBe(2)
  })

  it('stores a PreviousVersionEntry with correct structure', () => {
    const id = createProposal(db, 'user_patterns', 'morning', 'gym')
    resolveProposal(db, id, true)
    const row = db.prepare('SELECT previous_versions FROM companion_core_memory WHERE id = 1').get() as { previous_versions: string }
    const versions = JSON.parse(row.previous_versions)
    expect(versions).toHaveLength(1)
    expect(versions[0].version).toBe(1)
    expect(versions[0].section).toBe('userPatterns')
    expect(versions[0].snapshot).toEqual({})
    expect(typeof versions[0].changed_at).toBe('string')
  })

  it('sets proposal status to "accepted"', () => {
    const id = createProposal(db, 'user_facts', 'k', 'v')
    resolveProposal(db, id, true)
    const row = db.prepare('SELECT status FROM ccm_proposals WHERE id = ?').get(id) as { status: string }
    expect(row.status).toBe('accepted')
  })

  it('does not affect other CCM sections', () => {
    const id = createProposal(db, 'user_facts', 'city', 'London')
    resolveProposal(db, id, true)
    const ccm = getCCM(db)!
    expect(ccm.userPatterns).toEqual({})
    expect(ccm.relationshipNotes).toEqual({})
  })

  it('previous_versions caps at 5 — oldest entry dropped after 6th accept', () => {
    for (let i = 0; i < 6; i++) {
      const id = createProposal(db, 'user_facts', `key${i}`, `val${i}`)
      resolveProposal(db, id, true)
    }
    const row = db.prepare('SELECT previous_versions FROM companion_core_memory WHERE id = 1').get() as { previous_versions: string }
    const versions = JSON.parse(row.previous_versions)
    expect(versions).toHaveLength(5)
    // version=1 entry was oldest — it should have been dropped; oldest remaining is version=2
    expect(versions[0].version).toBe(2)
  })
})

// ─── resolveProposal — reject ─────────────────────────────────────────────────
describe('resolveProposal — reject', () => {
  it('sets proposal status to "rejected"', () => {
    const id = createProposal(db, 'user_facts', 'k', 'v')
    resolveProposal(db, id, false)
    const row = db.prepare('SELECT status FROM ccm_proposals WHERE id = ?').get(id) as { status: string }
    expect(row.status).toBe('rejected')
  })

  it('does NOT modify the CCM row when proposal is rejected', () => {
    const id = createProposal(db, 'user_facts', 'occupation', 'hacker')
    resolveProposal(db, id, false)
    expect(getCCM(db)!.userFacts).toEqual({})
  })

  it('does NOT bump version when proposal is rejected', () => {
    const id = createProposal(db, 'user_facts', 'k', 'v')
    resolveProposal(db, id, false)
    const row = db.prepare('SELECT version FROM companion_core_memory WHERE id = 1').get() as { version: number }
    expect(row.version).toBe(1)
  })
})

// ─── resolveProposal — error paths ───────────────────────────────────────────
describe('resolveProposal — error paths', () => {
  it('throws "Proposal not found: 9999" for non-existent id', () => {
    expect(() => resolveProposal(db, 9999, true)).toThrow('Proposal not found: 9999')
  })

  it('throws "Proposal already resolved" when accepting an already-accepted proposal', () => {
    const id = createProposal(db, 'user_facts', 'k', 'v')
    resolveProposal(db, id, true)
    expect(() => resolveProposal(db, id, true)).toThrow(`Proposal already resolved: ${id}`)
  })

  it('throws "Proposal already resolved" when rejecting an already-rejected proposal', () => {
    const id = createProposal(db, 'user_facts', 'k', 'v')
    resolveProposal(db, id, false)
    expect(() => resolveProposal(db, id, false)).toThrow(`Proposal already resolved: ${id}`)
  })
})

// ─── updateCCMSection ─────────────────────────────────────────────────────────
describe('updateCCMSection', () => {
  it('merges data into the specified section', () => {
    updateCCMSection(db, 'user_facts', { city: 'Tokyo' })
    expect(getCCM(db)!.userFacts['city']).toBe('Tokyo')
  })

  it('bumps version', () => {
    updateCCMSection(db, 'user_patterns', { morning: 'gym' })
    const row = db.prepare('SELECT version FROM companion_core_memory WHERE id = 1').get() as { version: number }
    expect(row.version).toBe(2)
  })

  it('throws on invalid section', () => {
    expect(() => updateCCMSection(db, 'invalid', { k: 'v' })).toThrow('Invalid CCM section: invalid')
  })

  it('stores a PreviousVersionEntry', () => {
    updateCCMSection(db, 'relationship_notes', { trust: 'high' })
    const row = db.prepare('SELECT previous_versions FROM companion_core_memory WHERE id = 1').get() as { previous_versions: string }
    const versions = JSON.parse(row.previous_versions)
    expect(versions).toHaveLength(1)
    expect(versions[0].section).toBe('relationshipNotes')
  })
})

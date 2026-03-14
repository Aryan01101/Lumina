/**
 * CCM Integration Tests — Phase 5
 *
 * Tests that the CCM module works correctly alongside the Phase 3 (activity) and
 * Phase 4 (memory) systems on a shared in-memory database. All Ollama, reranker,
 * and node-cron dependencies are mocked so these tests run offline and deterministically.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../src/main/db/migrations'

// ─── Mock the db singleton ────────────────────────────────────────────────────
// Memory retention and memory/index use getDb() internally.
// We inject our test DB via __setTestDb.
vi.mock('../../src/main/db', () => {
  let _db: Database.Database | null = null
  return {
    getDb: () => {
      if (!_db) throw new Error('Test DB not initialised — call __setTestDb first')
      return _db
    },
    vecAvailable: false,
    __setTestDb: (db: Database.Database) => { _db = db }
  }
})

// ─── Mock Ollama embedder ─────────────────────────────────────────────────────
// Returns null → memory pipeline skips vector store, uses FTS5-only path
vi.mock('../../src/main/memory/embedder', () => ({
  embedText: vi.fn().mockResolvedValue(null)
}))

// ─── Mock reranker worker ─────────────────────────────────────────────────────
vi.mock('../../src/main/memory/reranker', () => ({
  initReranker:     vi.fn(),
  rerankCandidates: vi.fn().mockResolvedValue([]),
  isRerankerReady:  vi.fn().mockReturnValue(false),
  terminateReranker: vi.fn().mockResolvedValue(undefined)
}))

// ─── Mock node-cron ───────────────────────────────────────────────────────────
vi.mock('node-cron', () => ({
  default: { schedule: vi.fn() },
  schedule: vi.fn()
}))

// ─── Imports (after mocks) ────────────────────────────────────────────────────
import { ingestEntry, retrieveRelevant } from '../../src/main/memory'
import { fetchFtsCandidates } from '../../src/main/memory/retrieval'
import {
  getCCM,
  getCCMSummary,
  getPendingProposals,
  createProposal,
  resolveProposal
} from '../../src/main/ccm'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { __setTestDb } = await import('../../src/main/db') as any

// ─── Test DB helper ───────────────────────────────────────────────────────────
function openTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db, false)
  return db
}

let db: Database.Database

beforeEach(() => {
  db = openTestDb()
  __setTestDb(db)
})

afterEach(() => {
  db.close()
})

// ─── Test Suites ──────────────────────────────────────────────────────────────

describe('CCM + Memory coexistence', () => {
  it('inserting memory chunks does not affect companion_core_memory', async () => {
    await ingestEntry('journal', 1, 'I am learning TypeScript every day', 'freeform')
    const ccm = getCCM(db)!
    expect(ccm.userFacts).toEqual({})
    expect(ccm.version).toBe(1)
  })

  it('getCCM and fetchFtsCandidates both operate on the same DB without conflict', async () => {
    await ingestEntry('journal', 1, 'deep work session completed successfully', 'freeform')
    const ccm = getCCM(db)
    const chunks = fetchFtsCandidates(db, 'deep work', 5)
    expect(ccm).not.toBeNull()
    expect(chunks.length).toBeGreaterThan(0)
  })
})

describe('Proposal with nullable source_message_id', () => {
  it('createProposal with source_message_id=null succeeds (FK is nullable)', () => {
    // messages table is empty but FK is nullable — SQLite allows null
    expect(() =>
      createProposal(db, 'user_facts', 'city', 'Berlin', null)
    ).not.toThrow()
  })

  it('created proposal has sourceMessageId=null', () => {
    createProposal(db, 'user_facts', 'city', 'Berlin', null)
    expect(getPendingProposals(db)[0].sourceMessageId).toBeNull()
  })
})

describe('Full proposal pipeline: create → list → resolve → read', () => {
  it('getCCM reflects an accepted proposal after the full pipeline', () => {
    const id = createProposal(db, 'user_facts', 'name', 'Bob')

    const pending = getPendingProposals(db)
    expect(pending).toHaveLength(1)
    expect(pending[0].id).toBe(id)

    resolveProposal(db, id, true)

    const ccm = getCCM(db)!
    expect(ccm.userFacts['name']).toBe('Bob')
    expect(ccm.version).toBe(2)
  })

  it('rejected proposal does not appear in getPendingProposals', () => {
    const id = createProposal(db, 'user_facts', 'name', 'Charlie')
    resolveProposal(db, id, false)
    expect(getPendingProposals(db)).toHaveLength(0)
  })
})

describe('Version chain integrity', () => {
  it('accepts 3 proposals → version===4, previous_versions has 3 entries', () => {
    const id1 = createProposal(db, 'user_facts',          'name',    'Alice')
    const id2 = createProposal(db, 'user_patterns',       'morning', 'gym')
    const id3 = createProposal(db, 'user_facts',          'age',     30)

    resolveProposal(db, id1, true)  // v1 → v2
    resolveProposal(db, id2, true)  // v2 → v3
    resolveProposal(db, id3, true)  // v3 → v4

    const row = db
      .prepare('SELECT version, previous_versions FROM companion_core_memory WHERE id = 1')
      .get() as { version: number; previous_versions: string }

    expect(row.version).toBe(4)
    const versions = JSON.parse(row.previous_versions)
    expect(versions).toHaveLength(3)
    expect(versions[0].version).toBe(1)
    expect(versions[1].version).toBe(2)
    expect(versions[2].version).toBe(3)
  })

  it('each entry records the correct section and pre-change snapshot', () => {
    const id = createProposal(db, 'user_facts', 'occupation', 'designer')
    resolveProposal(db, id, true)

    const row = db
      .prepare('SELECT previous_versions FROM companion_core_memory WHERE id = 1')
      .get() as { previous_versions: string }
    const versions = JSON.parse(row.previous_versions)

    expect(versions[0].section).toBe('userFacts')
    expect(versions[0].snapshot).toEqual({})  // section was empty before accept
  })

  it('snapshot for second accept contains value from first accept', () => {
    const id1 = createProposal(db, 'user_facts', 'name', 'Alice')
    resolveProposal(db, id1, true)  // user_facts = { name: 'Alice' }

    const id2 = createProposal(db, 'user_facts', 'age', 30)
    resolveProposal(db, id2, true)  // user_facts = { name: 'Alice', age: 30 }

    const row = db
      .prepare('SELECT previous_versions FROM companion_core_memory WHERE id = 1')
      .get() as { previous_versions: string }
    const versions = JSON.parse(row.previous_versions)

    // Second entry snapshot = state before second accept = { name: 'Alice' }
    expect(versions[1].snapshot).toEqual({ name: 'Alice' })
  })
})

describe('getCCMSummary after pipeline', () => {
  it('contains accepted fact key and value in summary', () => {
    const id = createProposal(db, 'user_facts', 'role', 'product manager')
    resolveProposal(db, id, true)
    const summary = getCCMSummary(db)
    expect(summary).not.toBe('')
    expect(summary).toContain('role')
    expect(summary).toContain('product manager')
  })
})

describe('getPendingProposals after mixed resolves', () => {
  it('3 created, 1 accepted, 1 rejected → 1 pending remains', () => {
    const id1 = createProposal(db, 'user_facts',          'k1', 'v1')
    const id2 = createProposal(db, 'user_patterns',       'k2', 'v2')
    const id3 = createProposal(db, 'relationship_notes',  'k3', 'v3')

    resolveProposal(db, id1, true)   // accepted
    resolveProposal(db, id2, false)  // rejected

    const pending = getPendingProposals(db)
    expect(pending).toHaveLength(1)
    expect(pending[0].id).toBe(id3)
  })
})

describe('Memory retrieval alongside CCM', () => {
  it('retrieveRelevant and getCCM both succeed on the same db instance', async () => {
    await ingestEntry('journal', 1, 'I enjoy morning running and coffee', 'freeform')
    createProposal(db, 'user_patterns', 'morning_routine', 'run then coffee')

    // retrieveRelevant uses getDb() internally (mocked to return our test db)
    // No Ollama + empty reranker scores → FTS5-only path
    const result = await retrieveRelevant('morning routine')
    expect(result).toHaveProperty('chunks')
    expect(result).toHaveProperty('durationMs')

    const ccm = getCCM(db)
    expect(ccm).not.toBeNull()
    // Proposal is pending — userPatterns still empty
    expect(ccm!.userPatterns).toEqual({})
  })
})

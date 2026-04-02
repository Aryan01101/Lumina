/**
 * Chat Integration Tests — Phase 6
 *
 * Tests the full chat pipeline (conversation management, message persistence,
 * LLM call logging) with a real in-memory DB and mocked Ollama/memory deps.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../../src/main/db/migrations'

// ─── Mock db singleton ────────────────────────────────────────────────────────
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

// ─── Mock Ollama client ───────────────────────────────────────────────────────
vi.mock('../../src/main/chat/ollamaClient', () => ({
  streamGenerate: vi.fn().mockImplementation(
    async (
      _opts: unknown,
      onToken: (t: string) => void,
      onDone: (r: { fullText: string; promptTokens: number; completionTokens: number; durationMs: number }) => void
    ) => {
      onToken('Hello')
      onToken(' there')
      onDone({ fullText: 'Hello there', promptTokens: 10, completionTokens: 5, durationMs: 200 })
    }
  ),
  generate:   vi.fn().mockResolvedValue(null),
  pingOllama: vi.fn().mockResolvedValue(true)
}))

// ─── Mock embedder (no Ollama calls) ─────────────────────────────────────────
vi.mock('../../src/main/memory/embedder', () => ({
  embedText: vi.fn().mockResolvedValue(null)
}))

// ─── Mock reranker worker ─────────────────────────────────────────────────────
vi.mock('../../src/main/memory/reranker', () => ({
  initReranker:      vi.fn(),
  rerankCandidates:  vi.fn().mockResolvedValue([]),
  isRerankerReady:   vi.fn().mockReturnValue(false),
  terminateReranker: vi.fn().mockResolvedValue(undefined)
}))

// ─── Mock node-cron ───────────────────────────────────────────────────────────
vi.mock('node-cron', () => ({
  default: { schedule: vi.fn() },
  schedule: vi.fn()
}))

// ─── Mock activity monitor ────────────────────────────────────────────────────
vi.mock('../../src/main/activity', () => ({
  getCurrentActivity: vi.fn().mockReturnValue({
    state: 'BROWSING',
    appName: 'Chrome',
    startedAt: new Date()
  })
}))

// ─── Mock CCM module ─────────────────────────────────────────────────────────
vi.mock('../../src/main/ccm', () => ({
  getCCMSummary: vi.fn().mockReturnValue('')
}))

// ─── Imports (after mocks) ────────────────────────────────────────────────────
import {
  getOrCreateConversation,
  getConversationHistory,
  saveMessage,
  logLlmCall,
  handleChatMessage
} from '../../src/main/chat'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { __setTestDb } = await import('../../src/main/db') as any

// ─── Helpers ─────────────────────────────────────────────────────────────────

function openTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db, false)
  return db
}

interface FakeWindow {
  webContents: { send: ReturnType<typeof vi.fn> }
  sentDeltas(): string[]
  sentDone(): unknown
}

function makeFakeWindow(): FakeWindow {
  const calls: Array<[string, unknown]> = []
  const send = vi.fn((channel: string, data: unknown) => { calls.push([channel, data]) })
  return {
    webContents: { send },
    sentDeltas: () => calls.filter(([c]) => c === 'chat:delta').map(([, d]) => d as string),
    sentDone:   () => calls.find(([c]) => c === 'chat:done')?.[1] ?? null
  }
}

let db: Database.Database

beforeEach(() => {
  db = openTestDb()
  __setTestDb(db)
})

afterEach(() => {
  db.close()
  vi.clearAllMocks()
})

// ─── getOrCreateConversation ──────────────────────────────────────────────────

describe('getOrCreateConversation', () => {
  it('creates a new conversation when conversationId is "new"', () => {
    const id = getOrCreateConversation(db, 'new')
    expect(typeof id).toBe('number')
    expect(id).toBeGreaterThan(0)
    expect(db.prepare('SELECT id FROM conversations WHERE id = ?').get(id)).toBeDefined()
  })

  it('creates a new conversation when conversationId is non-numeric', () => {
    const id = getOrCreateConversation(db, 'not-a-number')
    expect(id).toBeGreaterThan(0)
  })

  it('returns an existing conversation id when it exists in DB', () => {
    const existing = db.prepare('INSERT INTO conversations DEFAULT VALUES').run().lastInsertRowid as number
    expect(getOrCreateConversation(db, String(existing))).toBe(existing)
  })

  it('creates a new conversation when numeric id does not exist in DB', () => {
    const returned = getOrCreateConversation(db, '9999')
    expect(returned).not.toBe(9999)
    expect(db.prepare('SELECT id FROM conversations WHERE id = ?').get(returned)).toBeDefined()
  })
})

// ─── saveMessage + getConversationHistory ─────────────────────────────────────

describe('saveMessage and getConversationHistory', () => {
  it('saveMessage stores a user message and returns a positive id', () => {
    const convId = getOrCreateConversation(db, 'new')
    const msgId = saveMessage(db, convId, 'user', 'hello!', [], null)
    expect(typeof msgId).toBe('number')
    expect(msgId).toBeGreaterThan(0)
  })

  it('getConversationHistory returns saved messages oldest-first', () => {
    const convId = getOrCreateConversation(db, 'new')
    saveMessage(db, convId, 'user',      'message one', [], null)
    saveMessage(db, convId, 'assistant', 'reply one',   [], null)
    saveMessage(db, convId, 'user',      'message two', [], null)

    const history = getConversationHistory(db, convId)
    expect(history).toHaveLength(3)
    expect(history[0].content).toBe('message one')
    expect(history[2].content).toBe('message two')
  })

  it('saveMessage stores retrieved_chunk_ids as JSON array', () => {
    const convId = getOrCreateConversation(db, 'new')
    saveMessage(db, convId, 'assistant', 'response', [1, 2, 3], 0.85)
    const row = db.prepare(
      'SELECT retrieved_chunk_ids, groundedness_score FROM messages WHERE conversation_id = ?'
    ).get(convId) as { retrieved_chunk_ids: string; groundedness_score: number }
    expect(JSON.parse(row.retrieved_chunk_ids)).toEqual([1, 2, 3])
    expect(row.groundedness_score).toBeCloseTo(0.85, 5)
  })

  it('getConversationHistory excludes system messages', () => {
    const convId = getOrCreateConversation(db, 'new')
    saveMessage(db, convId, 'user',      'visible',       [], null)
    saveMessage(db, convId, 'assistant', 'also visible',  [], null)
    db.prepare(
      "INSERT INTO messages (conversation_id, role, content, retrieved_chunk_ids) VALUES (?, 'system', 'hidden system prompt', '[]')"
    ).run(convId)

    const history = getConversationHistory(db, convId)
    expect(history.every(m => m.role !== 'system')).toBe(true)
    expect(history).toHaveLength(2)
  })
})

// ─── logLlmCall ───────────────────────────────────────────────────────────────

describe('logLlmCall', () => {
  it('inserts a row into llm_calls with the correct context value', () => {
    logLlmCall(db, 'llama3.1:8b', 100, 50, 350, 'chat')
    const row = db.prepare('SELECT * FROM llm_calls ORDER BY id DESC LIMIT 1').get() as {
      model: string; prompt_tokens: number; completion_tokens: number; duration_ms: number; context: string
    }
    expect(row.model).toBe('llama3.1:8b')
    expect(row.prompt_tokens).toBe(100)
    expect(row.completion_tokens).toBe(50)
    expect(row.duration_ms).toBe(350)
    expect(row.context).toBe('chat')
  })
})

// ─── handleChatMessage ────────────────────────────────────────────────────────

describe('handleChatMessage', () => {
  it('sends chat:delta tokens and then chat:done with groundedness_score:null', async () => {
    const win = makeFakeWindow()
    await handleChatMessage(db, win as unknown as Electron.CrossProcessExports.BrowserWindow, {
      content: 'hello', conversationId: 'new'
    })
    expect(win.sentDeltas()).toContain('Hello')
    expect(win.sentDeltas()).toContain(' there')
    expect(win.sentDone()).toEqual({ groundedness_score: null, error: null })
  })

  it('persists user message and assistant message to messages table', async () => {
    const win = makeFakeWindow()
    await handleChatMessage(db, win as unknown as Electron.CrossProcessExports.BrowserWindow, {
      content: 'test message', conversationId: 'new'
    })
    const rows = db.prepare('SELECT role, content FROM messages ORDER BY id ASC').all() as Array<{
      role: string; content: string
    }>
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ role: 'user',      content: 'test message' })
    expect(rows[1]).toMatchObject({ role: 'assistant', content: 'Hello there' })
  })

  it('creates a conversation row automatically', async () => {
    const win = makeFakeWindow()
    await handleChatMessage(db, win as unknown as Electron.CrossProcessExports.BrowserWindow, {
      content: 'hi', conversationId: 'new'
    })
    const count = (db.prepare('SELECT COUNT(*) as n FROM conversations').get() as { n: number }).n
    expect(count).toBe(1)
  })

  it('logs one llm_call row with context="chat"', async () => {
    const win = makeFakeWindow()
    await handleChatMessage(db, win as unknown as Electron.CrossProcessExports.BrowserWindow, {
      content: 'hello', conversationId: 'new'
    })
    const row = db.prepare("SELECT context FROM llm_calls WHERE context = 'chat'").get()
    expect(row).toBeDefined()
  })

  it('returns { ok: true } on success', async () => {
    const win = makeFakeWindow()
    const result = await handleChatMessage(
      db, win as unknown as Electron.CrossProcessExports.BrowserWindow,
      { content: 'hi', conversationId: 'new' }
    )
    expect(result).toMatchObject({ ok: true })
  })

  it('second message in same conversation appends to existing conversation', async () => {
    const win = makeFakeWindow()
    await handleChatMessage(db, win as unknown as Electron.CrossProcessExports.BrowserWindow, {
      content: 'first', conversationId: 'new'
    })
    const convId = (db.prepare('SELECT id FROM conversations ORDER BY id LIMIT 1').get() as { id: number }).id

    await handleChatMessage(db, win as unknown as Electron.CrossProcessExports.BrowserWindow, {
      content: 'second', conversationId: String(convId)
    })

    // One conversation, four messages (2 user + 2 assistant)
    const convCount = (db.prepare('SELECT COUNT(*) as n FROM conversations').get() as { n: number }).n
    const msgCount  = (db.prepare('SELECT COUNT(*) as n FROM messages').get() as { n: number }).n
    expect(convCount).toBe(1)
    expect(msgCount).toBe(4)
  })
})

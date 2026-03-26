import { ipcMain, BrowserWindow, shell } from 'electron'
import { getDb } from '../db'
import { ingestEntry, retrieveRelevant, retryPendingEmbeddings } from '../memory'
import {
  getCCM,
  getPendingProposals,
  createProposal,
  resolveProposal,
  updateCCMSection
} from '../ccm'
import { handleChatMessage } from '../chat'
import { getSettings, setSetting, type AppSettings } from '../settings'
import { isOllamaAvailable } from '../systemState'
import { isDegradedMode, getCurrentActivity } from '../activity'
import { getCurrentSession, getCurrentSessionMinutes } from '../activity/sessions'
import {
  createTodo,
  listTodos,
  getTodo,
  completeTodo,
  uncompleteTodo,
  updateTodo,
  deleteTodo,
  getTodoStats
} from '../todos'

/**
 * Registers all IPC handlers for the main process.
 * Each handler corresponds to a channel defined in PRD section 5.3.
 * Handlers for Phase 3+ modules are stubbed with TODO comments.
 */
export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // ─── Journal ──────────────────────────────────────────────────────────────

  ipcMain.handle('journal:create', async (_event, payload: {
    content: string
    mode: 'prompted' | 'freeform'
    guidingQuestion?: string
  }) => {
    const db = getDb()
    const result = db.prepare(`
      INSERT INTO journal_entries (mode, content, guiding_question)
      VALUES (?, ?, ?)
    `).run(payload.mode, payload.content, payload.guidingQuestion ?? null)

    const entryId = result.lastInsertRowid as number
    setImmediate(() => {
      ingestEntry('journal', entryId, payload.content, payload.mode).catch((err) =>
        console.error('[Memory] Background ingest failed:', err)
      )
    })

    return { id: entryId, created_at: new Date().toISOString() }
  })

  // ─── Chat ─────────────────────────────────────────────────────────────────

  ipcMain.handle('chat:message', async (_event, payload: {
    content: string
    conversationId: string
  }) => {
    if (typeof payload.content !== 'string' || payload.content.trim().length === 0) {
      return { error: 'Empty message' }
    }
    const MAX_INPUT_CHARS = 4_000
    if (payload.content.length > MAX_INPUT_CHARS) {
      return { error: `Message too long (max ${MAX_INPUT_CHARS} characters)` }
    }
    return handleChatMessage(getDb(), mainWindow, payload)
  })

  ipcMain.handle('chat:getHistory', async (_event, payload: { conversationId: number }) => {
    try {
      const db = getDb()
      const messages = db.prepare(`
        SELECT id, role, content, groundedness_score, created_at
        FROM messages
        WHERE conversation_id = ?
        ORDER BY id ASC
      `).all(payload.conversationId) as Array<{
        id: number
        role: string
        content: string
        groundedness_score: number | null
        created_at: string
      }>
      return { messages }
    } catch (err) {
      return { error: (err as Error).message, messages: [] }
    }
  })

  ipcMain.handle('chat:listConversations', async () => {
    try {
      const db = getDb()
      const conversations = db.prepare(`
        SELECT
          c.id,
          c.created_at,
          (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1) as last_message,
          (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1) as last_message_at
        FROM conversations c
        ORDER BY c.id DESC
        LIMIT 20
      `).all() as Array<{
        id: number
        created_at: string
        last_message: string | null
        last_message_at: string | null
      }>
      return { conversations }
    } catch (err) {
      return { error: (err as Error).message, conversations: [] }
    }
  })

  // ─── Mood ─────────────────────────────────────────────────────────────────

  ipcMain.handle('mood:log', async (_event, payload: { value: string }) => {
    const scoreMap: Record<string, number> = {
      frustrated: 0.25,
      okay: 0.5,
      good: 0.75,
      amazing: 1.0
    }
    const db = getDb()
    const result = db.prepare(`
      INSERT INTO mood_logs (source, raw_value, normalised_score)
      VALUES ('emoji_vibe', ?, ?)
    `).run(payload.value, scoreMap[payload.value] ?? 0.5)

    return { id: result.lastInsertRowid }
  })

  // ─── Todos ────────────────────────────────────────────────────────────────

  ipcMain.handle('todos:create', async (_event, payload: {
    content: string
    priority?: number
    dueDate?: string
    aiSuggested?: boolean
  }) => {
    try {
      const db = getDb()
      const id = createTodo(db, payload.content, {
        priority: payload.priority,
        dueDate: payload.dueDate,
        aiSuggested: payload.aiSuggested
      })
      return { ok: true, id }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('todos:list', async (_event, payload?: { status?: 'pending' | 'completed' }) => {
    try {
      const db = getDb()
      const todos = listTodos(db, payload?.status)
      return { ok: true, todos }
    } catch (err) {
      return { ok: false, error: (err as Error).message, todos: [] }
    }
  })

  ipcMain.handle('todos:get', async (_event, payload: { id: number }) => {
    try {
      const db = getDb()
      const todo = getTodo(db, payload.id)
      return { ok: true, todo }
    } catch (err) {
      return { ok: false, error: (err as Error).message, todo: null }
    }
  })

  ipcMain.handle('todos:complete', async (_event, payload: { id: number }) => {
    try {
      const db = getDb()
      const success = completeTodo(db, payload.id)
      return { ok: success }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('todos:uncomplete', async (_event, payload: { id: number }) => {
    try {
      const db = getDb()
      const success = uncompleteTodo(db, payload.id)
      return { ok: success }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('todos:update', async (_event, payload: {
    id: number
    content?: string
    priority?: number
    dueDate?: string | null
  }) => {
    try {
      const db = getDb()
      const success = updateTodo(db, payload.id, {
        content: payload.content,
        priority: payload.priority,
        dueDate: payload.dueDate
      })
      return { ok: success }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('todos:delete', async (_event, payload: { id: number }) => {
    try {
      const db = getDb()
      const success = deleteTodo(db, payload.id)
      return { ok: success }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('todos:stats', async () => {
    try {
      const db = getDb()
      const stats = getTodoStats(db)
      return { ok: true, stats }
    } catch (err) {
      return { ok: false, error: (err as Error).message, stats: { pending: 0, completed: 0, total: 0 } }
    }
  })

  // ─── Memory ───────────────────────────────────────────────────────────────

  ipcMain.handle('memory:search', async (_event, payload: { query: string }) => {
    return await retrieveRelevant(payload.query)
  })

  // ─── CCM ──────────────────────────────────────────────────────────────────

  ipcMain.handle('ccm:get', async () => {
    return { ccm: getCCM(getDb()) }
  })

  ipcMain.handle('ccm:update', async (_event, payload: { section: string; data: Record<string, unknown> }) => {
    try {
      updateCCMSection(getDb(), payload.section, payload.data)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('ccm:resolve', async (_event, payload: { id: number; accept: boolean }) => {
    try {
      resolveProposal(getDb(), payload.id, payload.accept)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('ccm:create-proposal', async (_event, payload: { section: string; key: string; value: unknown }) => {
    try {
      const id = createProposal(getDb(), payload.section, payload.key, payload.value, null)
      return { ok: true, id }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('ccm:get-pending', async () => {
    return { proposals: getPendingProposals(getDb()) }
  })

  // ─── Settings ─────────────────────────────────────────────────────────────

  ipcMain.handle('settings:get', async () => {
    return { settings: getSettings() }
  })

  ipcMain.handle('settings:set', async (_event, payload: { key: string; value: unknown }) => {
    try {
      setSetting(payload.key as keyof AppSettings, payload.value as never)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  // ─── Metrics ──────────────────────────────────────────────────────────────

  ipcMain.handle('metrics:get', async () => {
    const db = getDb()

    // Median (p50) response latency — last 50 chat LLM calls
    const latencyRows = db.prepare(`
      SELECT duration_ms FROM llm_calls
      WHERE context = 'chat'
      ORDER BY id DESC LIMIT 50
    `).all() as { duration_ms: number }[]
    const latency_p50 = latencyRows.length > 0
      ? latencyRows.map(r => r.duration_ms).sort((a, b) => a - b)[Math.floor(latencyRows.length / 2)]
      : null

    // Average groundedness — last 50 scored assistant messages
    const groundRow = db.prepare(`
      SELECT AVG(groundedness_score) as avg
      FROM (
        SELECT groundedness_score FROM messages
        WHERE role = 'assistant' AND groundedness_score IS NOT NULL
        ORDER BY id DESC LIMIT 50
      )
    `).get() as { avg: number | null }
    const groundedness_avg = groundRow?.avg ?? null

    // Agent initiation rate — non-SILENCE actions / total runs
    const agentTotals = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN action_type != 'SILENCE' THEN 1 ELSE 0 END) as initiated
      FROM agent_events
    `).get() as { total: number; initiated: number }
    const initiation_rate = agentTotals.total > 0
      ? agentTotals.initiated / agentTotals.total
      : null

    // Agent dismissal rate — dismissed / (engaged + dismissed)
    const dismissRow = db.prepare(`
      SELECT
        SUM(CASE WHEN user_response = 'dismissed' THEN 1 ELSE 0 END) as dismissed,
        SUM(CASE WHEN user_response IN ('engaged','dismissed') THEN 1 ELSE 0 END) as responded
      FROM agent_events
      WHERE action_type != 'SILENCE'
    `).get() as { dismissed: number; responded: number }
    const dismissal_rate = (dismissRow.responded ?? 0) > 0
      ? dismissRow.dismissed / dismissRow.responded
      : null

    const llmCount   = (db.prepare('SELECT COUNT(*) as count FROM llm_calls').get() as { count: number }).count
    const agentCount = (db.prepare('SELECT COUNT(*) as count FROM agent_events').get() as { count: number }).count

    return { latency_p50, groundedness_avg, initiation_rate, dismissal_rate, llm_call_count: llmCount, agent_event_count: agentCount }
  })

  // ─── System Status ────────────────────────────────────────────────────────

  ipcMain.handle('system:status', () => ({
    ollamaOk: isOllamaAvailable(),
    activityDegraded: isDegradedMode()
  }))

  ipcMain.handle('system:retry-embeddings', async () => {
    await retryPendingEmbeddings()
    return { ollamaOk: isOllamaAvailable() }
  })

  ipcMain.handle('activity:getCurrentSession', () => {
    const activity = getCurrentActivity()
    const sessionMinutes = getCurrentSessionMinutes()
    return {
      activityState: activity.state,
      appName: activity.appName,
      sessionMinutes
    }
  })

  ipcMain.handle('shell:open-url', async (_event, url: string) => {
    await shell.openExternal(url)
  })

  // ─── Renderer Logs ────────────────────────────────────────────────────────

  ipcMain.on('log:renderer', (_event, payload: { level: 'log' | 'warn' | 'error'; args: unknown[] }) => {
    const level = payload?.level ?? 'log'
    const args = payload?.args ?? []
    const prefix = '[Renderer]'
    if (level === 'error') {
      console.error(prefix, ...args)
    } else if (level === 'warn') {
      console.warn(prefix, ...args)
    } else {
      console.log(prefix, ...args)
    }
  })

  // ─── Window ───────────────────────────────────────────────────────────────

  ipcMain.on('window:setIgnoreMouseEvents', (_event, ignore: boolean) => {
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true })
  })
}

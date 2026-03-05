import { ipcMain, BrowserWindow } from 'electron'
import { getDb } from '../db'

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

    // Phase 4: trigger background embedding ingestion here

    return { id: result.lastInsertRowid, created_at: new Date().toISOString() }
  })

  // ─── Chat ─────────────────────────────────────────────────────────────────

  ipcMain.handle('chat:message', async (_event, payload: {
    content: string
    conversationId: string
  }) => {
    // Phase 6: implement memory-grounded chat with Ollama streaming
    console.log('[IPC] chat:message — Phase 6 implementation pending', payload.conversationId)

    // Placeholder: echo back a stub response
    mainWindow.webContents.send('chat:delta', 'Chat is not yet implemented (Phase 6). ')
    mainWindow.webContents.send('chat:done', { groundedness_score: null })

    return { ok: true }
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

  // ─── Memory ───────────────────────────────────────────────────────────────

  ipcMain.handle('memory:search', async (_event, payload: { query: string }) => {
    // Phase 4: hybrid retrieval + reranking
    console.log('[IPC] memory:search — Phase 4 implementation pending', payload.query)
    return { chunks: [] }
  })

  // ─── CCM ──────────────────────────────────────────────────────────────────

  ipcMain.handle('ccm:get', async () => {
    const db = getDb()
    const row = db.prepare('SELECT * FROM companion_core_memory WHERE id = 1').get() as Record<string, string> | undefined
    if (!row) return { ccm: null }

    return {
      ccm: {
        userFacts: JSON.parse(row.user_facts),
        userPatterns: JSON.parse(row.user_patterns),
        relationshipNotes: JSON.parse(row.relationship_notes),
        toneCalibration: JSON.parse(row.tone_calibration),
        lastUpdatedAt: row.last_updated_at,
        version: row.version
      }
    }
  })

  ipcMain.handle('ccm:update', async (_event, payload: { section: string; data: unknown }) => {
    // Phase 5: full CCM update with version history and proposal flow
    console.log('[IPC] ccm:update — Phase 5 implementation pending', payload.section)
    return { ok: true }
  })

  // ─── Settings ─────────────────────────────────────────────────────────────

  ipcMain.handle('settings:get', async () => {
    // Phase 8: return persistent settings from electron-store
    return {
      settings: {
        model: 'llama3.1:8b',
        activityMonitorEnabled: true,
        checkinFrequency: 'normal',
        observability: 'off'
      }
    }
  })

  ipcMain.handle('settings:set', async (_event, payload: { key: string; value: unknown }) => {
    // Phase 8: persist setting
    console.log('[IPC] settings:set — Phase 8 implementation pending', payload.key)
    return { ok: true }
  })

  // ─── Metrics ──────────────────────────────────────────────────────────────

  ipcMain.handle('metrics:get', async () => {
    // Phase 9: compute from llm_calls, retrieval_logs, agent_events
    const db = getDb()

    const llmCount = (db.prepare('SELECT COUNT(*) as count FROM llm_calls').get() as { count: number }).count
    const agentCount = (db.prepare('SELECT COUNT(*) as count FROM agent_events').get() as { count: number }).count

    return {
      latency_p50: null,
      groundedness_avg: null,
      initiation_rate: null,
      dismissal_rate: null,
      llm_call_count: llmCount,
      agent_event_count: agentCount
    }
  })

  // ─── Window ───────────────────────────────────────────────────────────────

  ipcMain.on('window:setIgnoreMouseEvents', (_event, ignore: boolean) => {
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true })
  })
}

/**
 * Chat Module — Phase 6
 *
 * Handles the full memory-grounded chat pipeline:
 *   1. Resolve or create conversation
 *   2. Load history + retrieve memory chunks
 *   3. Build system prompt (CCM + activity + memories)
 *   4. Stream Ollama response → send chat:delta events
 *   5. Persist messages + log LLM call
 *   6. Fire-and-forget groundedness scoring
 *
 * All functions take `db` as first param for testability.
 * The IPC handler in ipc/index.ts passes getDb() + mainWindow.
 */

import type Database from 'better-sqlite3'
import type { BrowserWindow } from 'electron'
import { retrieveRelevant } from '../memory'
import { getCCMSummary } from '../ccm'
import { getCurrentActivity } from '../activity'
import { buildPrompt } from './promptBuilder'
import { streamGenerate } from './ollamaClient'
import { scoreGroundedness } from './grounder'
import { routeTools, formatToolResultForContext, type ToolResult } from '../tools/router'
import { createAlarm } from '../tools/alarms'
import { listTodos, getTodoStats } from '../todos'

const DEFAULT_MODEL   = 'llama3.1:8b'
const MAX_HISTORY_MSG = 8   // last 4 turns

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role:    'user' | 'assistant' | 'system'
  content: string
}

// ─── Conversation helpers ─────────────────────────────────────────────────────

/**
 * Returns an existing conversation id, or creates a new one.
 * Accepts 'new' or any non-numeric string to force creation.
 */
export function getOrCreateConversation(db: Database.Database, conversationId: string): number {
  const parsed = parseInt(conversationId, 10)

  if (!isNaN(parsed) && String(parsed) === conversationId) {
    const row = db.prepare('SELECT id FROM conversations WHERE id = ?').get(parsed) as
      | { id: number }
      | undefined
    if (row) return row.id
  }

  // Create new
  const result = db.prepare('INSERT INTO conversations DEFAULT VALUES').run()
  return result.lastInsertRowid as number
}

/**
 * Returns the most recent N conversation messages (user + assistant only),
 * re-sorted oldest-first for the LLM context window.
 */
export function getConversationHistory(
  db: Database.Database,
  conversationId: number,
  limit = MAX_HISTORY_MSG
): ChatMessage[] {
  const rows = db.prepare(`
    SELECT role, content FROM (
      SELECT id, role, content FROM messages
      WHERE conversation_id = ? AND role != 'system'
      ORDER BY id DESC
      LIMIT ?
    ) ORDER BY id ASC
  `).all(conversationId, limit) as ChatMessage[]
  return rows
}

/**
 * Persists a message row and returns the new message id.
 */
export function saveMessage(
  db: Database.Database,
  conversationId: number,
  role: 'user' | 'assistant',
  content: string,
  retrievedChunkIds: number[],
  groundednessScore: number | null
): number {
  const result = db.prepare(`
    INSERT INTO messages (conversation_id, role, content, retrieved_chunk_ids, groundedness_score)
    VALUES (?, ?, ?, ?, ?)
  `).run(conversationId, role, content, JSON.stringify(retrievedChunkIds), groundednessScore)
  return result.lastInsertRowid as number
}

/**
 * Logs one row to llm_calls for observability.
 */
export function logLlmCall(
  db: Database.Database,
  model: string,
  promptTokens: number,
  completionTokens: number,
  durationMs: number,
  context: 'chat' | 'grounder' | 'agent'
): void {
  db.prepare(`
    INSERT INTO llm_calls (model, prompt_tokens, completion_tokens, duration_ms, context)
    VALUES (?, ?, ?, ?, ?)
  `).run(model, promptTokens, completionTokens, durationMs, context)
}

// ─── Main handler ─────────────────────────────────────────────────────────────

/**
 * Full chat pipeline. Called by the IPC handler for 'chat:message'.
 */
export async function handleChatMessage(
  db: Database.Database,
  mainWindow: BrowserWindow,
  payload: { content: string; conversationId: string }
): Promise<{ ok: boolean; conversationId: number }> {
  const { content, conversationId } = payload

  // 1. Resolve conversation
  const convId = getOrCreateConversation(db, conversationId)

  // 2. Load history
  const history = getConversationHistory(db, convId).map(m => ({
    role:    m.role as 'user' | 'assistant',
    content: m.content
  }))

  // 2.5. Detect and execute tools
  let toolResult: ToolResult | null = null
  let toolContext = ''
  try {
    toolResult = routeTools(content, db)
    if (toolResult) {
      // Execute alarm/timer creation
      if ((toolResult.tool === 'alarm' || toolResult.tool === 'timer') && toolResult.data) {
        const alarmData = toolResult.data as { type: 'alarm' | 'timer'; triggerAt: Date; message?: string }
        const alarmId = createAlarm(db, alarmData.type, alarmData.triggerAt, alarmData.message)

        const timeStr = alarmData.triggerAt.toLocaleString('en-US', {
          weekday: 'short',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })

        toolResult.message = `${alarmData.type === 'alarm' ? 'Alarm' : 'Timer'} set for ${timeStr}`
        toolResult.data = { ...alarmData, id: alarmId }
      }

      toolContext = formatToolResultForContext(toolResult)
      console.log('[Chat] Tool executed:', toolResult.tool, '-', toolResult.message)
      // Send tool result to renderer for special display
      mainWindow.webContents.send('chat:tool-result', toolResult)
    }
  } catch (err) {
    console.error('[Chat] Tool execution failed:', err)
  }

  // 3. Retrieve relevant memories (best-effort; fails gracefully)
  let retrievedChunks: string[] = []
  let retrievedChunkIds: number[] = []
  try {
    const memResult = await retrieveRelevant(content)
    retrievedChunks   = memResult.chunks.map(c => c.content)
    retrievedChunkIds = memResult.chunks.map(c => c.id)
  } catch {
    // memory engine unavailable — continue without
  }

  // 4. CCM summary + activity
  const ccmSummary    = getCCMSummary(db)
  const activity      = getCurrentActivity()
  const activityState = activity?.state ?? 'UNKNOWN'
  const activityApp   = activity?.appName ?? 'unknown'

  // 4.5. Generate todo context
  let todoContext = ''
  try {
    const stats = getTodoStats(db)
    if (stats.pending > 0) {
      const todos = listTodos(db, 'pending')
      const todoList = todos.slice(0, 5).map((t, i) => `${i + 1}. ${t.content}${t.aiSuggested ? ' (AI suggested)' : ''}`).join('\n')
      todoContext = `[Current Tasks]\nYou have ${stats.pending} pending task${stats.pending === 1 ? '' : 's'}:\n${todoList}${todos.length > 5 ? `\n... and ${todos.length - 5} more` : ''}`
    } else {
      todoContext = '[Current Tasks]\nNo pending tasks'
    }
  } catch (err) {
    console.error('[Chat] Failed to generate todo context:', err)
  }

  // 5. Build prompt
  const { system, conversationText } = buildPrompt(
    {
      ccmSummary,
      retrievedChunks,
      activityState,
      activityAppName: activityApp,
      history,
      toolContext,
      todoContext
    },
    content
  )

  // 6. Persist user message
  saveMessage(db, convId, 'user', content, [], null)

  // 7. Stream Ollama → send deltas
  let assistantText      = ''
  let promptTokens       = 0
  let completionTokens   = 0
  let durationMs         = 0
  let streamError: string | null = null

  await streamGenerate(
    { model: DEFAULT_MODEL, system, prompt: conversationText, stream: true },
    (token) => {
      assistantText += token
      mainWindow.webContents.send('chat:delta', token)
    },
    (result) => {
      assistantText    = result.fullText
      promptTokens     = result.promptTokens
      completionTokens = result.completionTokens
      durationMs       = result.durationMs
    },
    (errMsg) => {
      streamError = errMsg
      console.error('[Chat] Stream error:', errMsg)
    }
  )

  if (!assistantText.trim()) {
    assistantText = streamError
      ? 'Could not reach Ollama. Make sure it is running and the models are downloaded.'
      : 'No response was generated. The model may still be loading — please try again in a moment.'
    mainWindow.webContents.send('chat:delta', assistantText)
    console.warn('[Chat] Empty response —', streamError ?? 'model returned nothing (still loading?)')
  }

  // 8. Persist assistant message + log LLM call
  const assistantMsgId = saveMessage(
    db, convId, 'assistant', assistantText, retrievedChunkIds, null
  )
  logLlmCall(db, DEFAULT_MODEL, promptTokens, completionTokens, durationMs, 'chat')

  // 9. Send done event (groundedness null initially)
  mainWindow.webContents.send('chat:done', { groundedness_score: null, error: streamError })

  // 10. Fire-and-forget groundedness scoring
  if (retrievedChunks.length > 0) {
    setImmediate(async () => {
      try {
        const score = await scoreGroundedness(content, assistantText, retrievedChunks)
        if (score !== null) {
          db.prepare('UPDATE messages SET groundedness_score = ? WHERE id = ?')
            .run(score, assistantMsgId)
        }
      } catch (err) {
        console.error('[Chat] Groundedness scoring failed:', err)
      }
    })
  }

  return { ok: true, conversationId: convId }
}

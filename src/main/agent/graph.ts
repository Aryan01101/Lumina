/**
 * Agent StateGraph — Phase 7
 *
 * 6-node LangChain.js StateGraph implementing the Interruption Intelligence loop.
 *
 * Node 1 (gateCheck)  — 5-gate evaluation, no LLM
 * Node 2 (observe)    — DB reads: mood, recency, journal
 * Node 3 (analyse)    — hybrid memory retrieval + 1 Ollama call
 * Node 4 (decide)     — 1 Ollama call → CELEBRATE | CHECKIN | NUDGE | SILENCE
 * Node 5 (act)        — 1 Ollama call → message → push IPC (if not SILENCE)
 * Node 6 (log)        — write agent_events row
 */

import { StateGraph, END, Annotation } from '@langchain/langgraph'
import type { BrowserWindow } from 'electron'
import type Database from 'better-sqlite3'
import { evaluateAllGates } from './gates'
import { getMoodTrend, getLastJournalAt, getLastConversationAt, getLastInitiationAt, getConsecutiveDismissals } from './observer'
import { generate } from '../chat/ollamaClient'
import { logLlmCall } from '../chat'
import { retrieveRelevant } from '../memory'
import { getCCMSummary } from '../ccm'
import type { AgentState, ActionType } from './index'

const DEFAULT_MODEL = 'llama3.1:8b'

// ─── State annotation ─────────────────────────────────────────────────────────

const AgentAnnotation = Annotation.Root({
  trigger:               Annotation<string>(),
  activityState:         Annotation<string>(),
  isTransition:          Annotation<boolean>(),
  transitionContext:     Annotation<string>(),
  timeOfDay:             Annotation<string>(),
  lastInitiationAt:      Annotation<string | null>(),
  consecutiveDismissals: Annotation<number>(),
  pausedUntil:           Annotation<string | null>(),
  lastJournalAt:         Annotation<string | null>(),
  lastConversationAt:    Annotation<string | null>(),
  moodTrend7d:           Annotation<number | null>(),
  moodTrendDirection:    Annotation<string | null>(),
  gateResults:           Annotation<Record<string, string>>(),
  retrievedMemories:     Annotation<string[]>(),
  analysis:              Annotation<string>(),
  actionType:            Annotation<string>(),
  message:               Annotation<string | null>(),
  runId:                 Annotation<string>(),
  // Internal routing flag
  _gatePassed:           Annotation<boolean>()
})

type GraphState = typeof AgentAnnotation.State

// ─── Node 1 — gateCheck ───────────────────────────────────────────────────────

function makeGateCheckNode(db: Database.Database) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    const lastInitiation = getLastInitiationAt(db)
    const consecutiveDismissals = getConsecutiveDismissals(db)
    const thresholdMinutes = state.isTransition ? 60 : 120

    const { results, passed } = evaluateAllGates({
      activityState:         state.activityState as never,
      nowIso:                state.timeOfDay,
      lastInitiationAt:      lastInitiation,
      thresholdMinutes,
      consecutiveDismissals,
      pausedUntil:           state.pausedUntil
    })

    return {
      gateResults:           results,
      lastInitiationAt:      lastInitiation,
      consecutiveDismissals,
      actionType:            passed ? state.actionType : 'SILENCE',
      _gatePassed:           passed
    }
  }
}

// ─── Node 2 — observe ─────────────────────────────────────────────────────────

function makeObserveNode(db: Database.Database) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    const moodTrend      = getMoodTrend(db, 7)
    const lastJournalAt  = getLastJournalAt(db)
    const lastConvAt     = getLastConversationAt(db)

    return {
      moodTrend7d:        moodTrend.avg,
      moodTrendDirection: moodTrend.direction,
      lastJournalAt,
      lastConversationAt: lastConvAt
    }
  }
}

// ─── Node 3 — analyse ─────────────────────────────────────────────────────────

function makeAnalyseNode(db: Database.Database) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    let memories: string[] = []

    try {
      const memResult = await retrieveRelevant(
        `user ${state.activityState} mood ${state.moodTrendDirection ?? 'unknown'}`,
        3
      )
      memories = memResult.chunks.map(c => c.content)
    } catch {
      // memory engine unavailable — continue with no memories
    }

    const ccmSummary = getCCMSummary(db)
    const moodStr    = state.moodTrend7d != null
      ? `Mood avg: ${state.moodTrend7d.toFixed(2)} (${state.moodTrendDirection})`
      : 'No mood data'
    const journalStr = state.lastJournalAt
      ? `Last journal: ${Math.round((Date.now() - new Date(state.lastJournalAt).getTime()) / 3_600_000)}h ago`
      : 'No recent journal'
    const memoriesStr = memories.length > 0
      ? `Relevant memories:\n${memories.map((m, i) => `${i + 1}. ${m}`).join('\n')}`
      : ''

    const prompt = [
      `User context: activity=${state.activityState}, ${moodStr}, ${journalStr}.`,
      ccmSummary ? `CCM: ${ccmSummary}` : '',
      memoriesStr,
      'In 2 sentences, briefly analyse the user\'s current state and what they might need right now.'
    ].filter(Boolean).join('\n')

    let analysis = ''
    try {
      const result = await generate({
        model:       DEFAULT_MODEL,
        system:      'You are an AI companion assistant. Be concise and empathetic.',
        prompt,
        stream:      false,
        num_predict: 200
      })
      if (result) {
        analysis = result.fullText
        logLlmCall(db, DEFAULT_MODEL, result.promptTokens, result.completionTokens, result.durationMs, 'agent')
      }
    } catch {
      // Ollama unavailable — proceed with empty analysis
    }

    return { retrievedMemories: memories, analysis }
  }
}

// ─── Node 4 — decide ─────────────────────────────────────────────────────────

function makeDecideNode(db: Database.Database) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    const prompt = [
      `Analysis: ${state.analysis || 'No analysis available.'}`,
      'Based on this, choose the most appropriate action. SILENCE is the default.',
      'Options: CELEBRATE (user hit a milestone), CHECKIN (check how user is doing),',
      'NUDGE (gentle reminder about user\'s stated goals), SILENCE (do not interrupt).',
      'Reply with ONLY the action word — nothing else.'
    ].join('\n')

    let actionType: ActionType = 'SILENCE'
    try {
      const result = await generate({
        model:       DEFAULT_MODEL,
        system:      'You output only one word from: CELEBRATE, CHECKIN, NUDGE, SILENCE.',
        prompt,
        stream:      false,
        num_predict: 10
      })
      if (result) {
        const word = result.fullText.trim().toUpperCase()
        if (['CELEBRATE', 'CHECKIN', 'NUDGE', 'SILENCE'].includes(word)) {
          actionType = word as ActionType
        }
        logLlmCall(db, DEFAULT_MODEL, result.promptTokens, result.completionTokens, result.durationMs, 'agent')
      }
    } catch {
      // fallback to SILENCE
    }

    return { actionType }
  }
}

// ─── Node 5 — act ─────────────────────────────────────────────────────────────

function makeActNode(db: Database.Database, mainWindow: BrowserWindow) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    if (state.actionType === 'SILENCE') return { message: null }

    const memoriesStr = state.retrievedMemories.length > 0
      ? `Relevant context:\n${state.retrievedMemories.slice(0, 3).map((m, i) => `${i + 1}. ${m}`).join('\n')}`
      : ''

    const prompt = [
      `Action: ${state.actionType}`,
      `Analysis: ${state.analysis}`,
      memoriesStr,
      'Write one short message (1–2 sentences max) that is warm and direct.',
      'Do not start with "I" or "Hey". No markdown.'
    ].filter(Boolean).join('\n')

    let message: string | null = null
    try {
      const result = await generate({
        model:       DEFAULT_MODEL,
        system:      'You are Lumina, a warm AI companion. Be brief and human.',
        prompt,
        stream:      false,
        num_predict: 100
      })
      if (result) {
        message = result.fullText.trim() || null
        logLlmCall(db, DEFAULT_MODEL, result.promptTokens, result.completionTokens, result.durationMs, 'agent')
      }
    } catch {
      // Ollama unavailable — no message
    }

    if (message && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agent:status', {
        actionType: state.actionType,
        message
      })
    }

    return { message }
  }
}

// ─── Node 6 — log ─────────────────────────────────────────────────────────────

function makeLogNode(db: Database.Database) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    const gates = state.gateResults ?? {}
    try {
      db.prepare(`
        INSERT INTO agent_events
          (run_id, trigger, activity_state, gate_1, gate_2, gate_3, gate_4, gate_5, action_type, message_generated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        state.runId,
        state.trigger,
        state.activityState,
        gates.gate1 ?? null,
        gates.gate2 ?? null,
        gates.gate3 ?? null,
        gates.gate4 ?? null,
        gates.gate5 ?? null,
        state.actionType,
        state.message ?? null
      )
    } catch (err) {
      console.error('[Agent] Failed to log agent_event:', err)
    }
    return {}
  }
}

// ─── Routing ─────────────────────────────────────────────────────────────────

function routeAfterGates(state: GraphState): 'observe' | 'log' {
  return state._gatePassed ? 'observe' : 'log'
}

// ─── Graph factory ────────────────────────────────────────────────────────────

export function buildAgentGraph(
  db: Database.Database,
  mainWindow: BrowserWindow
): ReturnType<typeof StateGraph.prototype.compile> {
  const graph = new StateGraph(AgentAnnotation)

  graph.addNode('gateCheck', makeGateCheckNode(db))
  graph.addNode('observe',   makeObserveNode(db))
  graph.addNode('analyse',   makeAnalyseNode(db))
  graph.addNode('decide',    makeDecideNode(db))
  graph.addNode('act',       makeActNode(db, mainWindow))
  graph.addNode('log',       makeLogNode(db))

  graph.setEntryPoint('gateCheck')
  graph.addConditionalEdges('gateCheck', routeAfterGates, {
    observe: 'observe',
    log:     'log'
  })
  graph.addEdge('observe',  'analyse')
  graph.addEdge('analyse',  'decide')
  graph.addEdge('decide',   'act')
  graph.addEdge('act',      'log')
  graph.addEdge('log',      END)

  return graph.compile()
}

/**
 * Runs one full agent cycle and returns the final state.
 */
export async function runAgentGraph(
  initialState: AgentState,
  mainWindow: BrowserWindow,
  db: Database.Database
): Promise<AgentState> {
  const compiled = buildAgentGraph(db, mainWindow)
  const result   = await compiled.invoke({
    ...initialState,
    _gatePassed: false
  })
  return result as AgentState
}

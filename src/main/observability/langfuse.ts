/**
 * Langfuse Observability — Phase 9
 *
 * Optional Langfuse integration. Disabled by default (observability='off').
 * When enabled (observability='langfuse' + langfuseKey set), wraps LLM calls,
 * retrieval, and agent runs as Langfuse traces.
 *
 * All helpers are no-ops when disabled. Errors never propagate — fire-and-forget.
 *
 * Uses a top-level ESM import so vitest's vi.mock('langfuse', ...) can intercept
 * it correctly in tests. langfuse is in dependencies so it is always available.
 */

import { Langfuse } from 'langfuse'
import { getSetting } from '../settings'
import type { AgentState } from '../agent/index'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LangfuseClient = any

let _client: LangfuseClient | null = null

/**
 * Initialise the Langfuse client if observability=langfuse and a key is set.
 * Safe to call multiple times — resets and re-initialises each call.
 */
export function initLangfuse(): void {
  _client = null
  const mode = getSetting('observability')
  if (mode !== 'langfuse') return

  const key = getSetting('langfuseKey')
  if (!key) return

  try {
    _client = new Langfuse({ publicKey: key })
  } catch {
    _client = null
  }
}

/** Returns true if Langfuse is active and traces will be sent. */
export function isEnabled(): boolean {
  return _client !== null
}

/** Reset the client (used in tests and when settings change). */
export function resetLangfuse(): void {
  _client = null
}

/** Trace a full agent run cycle. No-op when disabled. */
export function traceAgentRun(state: AgentState): void {
  if (!_client) return
  try {
    _client.trace({
      name: 'agent-run',
      metadata: {
        runId:       state.runId,
        trigger:     state.trigger,
        actionType:  state.actionType,
        gateResults: state.gateResults
      }
    })
  } catch { /* fire-and-forget */ }
}

/** Trace a retrieval operation. No-op when disabled. */
export function traceRetrieval(
  query: string,
  chunkIds: number[],
  durationMs: number
): void {
  if (!_client) return
  try {
    _client.span({
      name:     'retrieval',
      input:    query,
      metadata: { chunkIds, durationMs }
    })
  } catch { /* fire-and-forget */ }
}

/** Trace an LLM call. No-op when disabled. */
export function traceLlmCall(
  context: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
  durationMs: number
): void {
  if (!_client) return
  try {
    _client.generation({
      name:             'llm-call',
      model,
      usage:            { promptTokens, completionTokens },
      metadata:         { context, durationMs }
    })
  } catch { /* fire-and-forget */ }
}

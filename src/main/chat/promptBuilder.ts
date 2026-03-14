/**
 * Prompt Builder — Phase 6
 *
 * Pure functions assembling the Ollama prompt from CCM, retrieved memory,
 * activity state, and conversation history. No side effects, no I/O.
 */

export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface PromptContext {
  ccmSummary: string
  retrievedChunks: string[]
  activityState: string
  activityAppName: string
  history: ConversationTurn[]
  toolContext?: string
}

export interface BuiltPrompt {
  system: string
  conversationText: string
}

const MAX_HISTORY_TURNS = 8   // last 4 user+assistant pairs
const MAX_CHUNKS        = 5

/**
 * Returns the fixed core identity block — who Lumina is and her constraints.
 */
export function buildCoreIdentity(): string {
  return [
    'You are Lumina, a private AI companion running entirely on this device.',
    'You are warm, concise, and direct — never preachy or verbose.',
    'You never share user data, never connect to external servers, and all',
    'your knowledge stays local. Respect the user\'s time and context.',
    'Respond in plain text only — no markdown, no lists unless explicitly asked.'
  ].join(' ')
}

/**
 * Assembles the system prompt from all contextual layers.
 * Caps chunks at MAX_CHUNKS. Omits empty sections.
 */
export function buildSystemPrompt(
  ccmSummary: string,
  retrievedChunks: string[],
  activityState: string,
  activityAppName: string,
  toolContext?: string
): string {
  const parts: string[] = []

  parts.push(buildCoreIdentity())

  parts.push(`\n[Current Activity]\nState: ${activityState}\nApp: ${activityAppName}`)

  if (toolContext) {
    parts.push(`\n${toolContext}`)
  }

  if (ccmSummary) {
    parts.push(`\n${ccmSummary}`)
  }

  const capped = retrievedChunks.slice(0, MAX_CHUNKS)
  if (capped.length > 0) {
    parts.push('\n[Relevant Memories]\n' + capped.map((c, i) => `${i + 1}. ${c}`).join('\n'))
  }

  return parts.join('\n')
}

/**
 * Formats the conversation turn history + current message into a single
 * prompt string for Ollama's non-chat /api/generate endpoint.
 * Limits history to the last MAX_HISTORY_TURNS messages.
 */
export function buildConversationPrompt(
  history: ConversationTurn[],
  currentMessage: string
): string {
  const recent = history.slice(-MAX_HISTORY_TURNS)
  const lines: string[] = []

  for (const turn of recent) {
    const label = turn.role === 'user' ? 'User' : 'Assistant'
    lines.push(`${label}: ${turn.content}`)
  }

  lines.push(`User: ${currentMessage}`)

  return lines.join('\n')
}

/**
 * Top-level assembler. Returns { system, conversationText } ready for
 * the Ollama client.
 */
export function buildPrompt(context: PromptContext, userMessage: string): BuiltPrompt {
  return {
    system: buildSystemPrompt(
      context.ccmSummary,
      context.retrievedChunks,
      context.activityState,
      context.activityAppName,
      context.toolContext
    ),
    conversationText: buildConversationPrompt(context.history, userMessage)
  }
}

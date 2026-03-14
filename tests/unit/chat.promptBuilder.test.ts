import { describe, it, expect } from 'vitest'
import {
  buildCoreIdentity,
  buildSystemPrompt,
  buildConversationPrompt,
  buildPrompt
} from '../../src/main/chat/promptBuilder'
import type { ConversationTurn, PromptContext } from '../../src/main/chat/promptBuilder'

// ─── buildCoreIdentity ────────────────────────────────────────────────────────

describe('buildCoreIdentity', () => {
  it('returns a non-empty string', () => {
    expect(buildCoreIdentity().length).toBeGreaterThan(50)
  })

  it('contains "Lumina" as the companion name', () => {
    expect(buildCoreIdentity()).toContain('Lumina')
  })

  it('mentions the local-only / privacy constraint', () => {
    expect(buildCoreIdentity().toLowerCase()).toMatch(/local|device|privacy|never.*share|no.*data/)
  })
})

// ─── buildSystemPrompt ────────────────────────────────────────────────────────

describe('buildSystemPrompt', () => {
  it('includes core identity in the output', () => {
    expect(buildSystemPrompt('', [], 'BROWSING', 'Chrome')).toContain('Lumina')
  })

  it('includes activity state and appName', () => {
    const result = buildSystemPrompt('', [], 'DEEP_WORK', 'VS Code')
    expect(result).toContain('DEEP_WORK')
    expect(result).toContain('VS Code')
  })

  it('includes CCM summary when non-empty', () => {
    const result = buildSystemPrompt('[User Context]\nFacts:\n  name: Alice', [], 'IDLE', 'Finder')
    expect(result).toContain('[User Context]')
    expect(result).toContain('Alice')
  })

  it('does NOT include a CCM block when ccmSummary is empty string', () => {
    expect(buildSystemPrompt('', [], 'IDLE', 'unknown')).not.toContain('[User Context]')
  })

  it('includes [Relevant Memories] block when chunks are provided', () => {
    const result = buildSystemPrompt('', ['I enjoy running', 'I work in tech'], 'BROWSING', 'Safari')
    expect(result).toContain('[Relevant Memories]')
    expect(result).toContain('I enjoy running')
    expect(result).toContain('I work in tech')
  })

  it('does NOT include [Relevant Memories] when chunks array is empty', () => {
    expect(buildSystemPrompt('', [], 'BROWSING', 'Safari')).not.toContain('[Relevant Memories]')
  })

  it('caps chunks at 5 even if more are provided', () => {
    const chunks = Array.from({ length: 8 }, (_, i) => `memory chunk ${i}`)
    const result = buildSystemPrompt('', chunks, 'BROWSING', 'Safari')
    expect(result).not.toContain('memory chunk 5')
    expect(result).not.toContain('memory chunk 6')
    expect(result).not.toContain('memory chunk 7')
  })

  it('total length stays under 5000 characters for a maxed-out context', () => {
    const ccm = '[User Context]\nFacts:\n  name: Alice\n  occupation: engineer'
    const chunks = Array.from({ length: 5 }, (_, i) =>
      `This is memory chunk number ${i} with some content about the user activities and preferences.`
    )
    expect(buildSystemPrompt(ccm, chunks, 'DEEP_WORK', 'VS Code').length).toBeLessThan(5000)
  })
})

// ─── buildConversationPrompt ──────────────────────────────────────────────────

describe('buildConversationPrompt', () => {
  it('includes the current user message', () => {
    expect(buildConversationPrompt([], 'How are you?')).toContain('How are you?')
  })

  it('formats previous turns with User: / Assistant: labels', () => {
    const history: ConversationTurn[] = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' }
    ]
    const result = buildConversationPrompt(history, 'what next?')
    expect(result).toContain('User: hello')
    expect(result).toContain('Assistant: hi there')
  })

  it('limits history to last 4 turns (8 messages) when more are provided', () => {
    const history: ConversationTurn[] = Array.from({ length: 12 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `message ${i}`
    }))
    const result = buildConversationPrompt(history, 'current')
    // messages 0–3 should be cut; messages 4–11 should appear
    expect(result).not.toContain('message 0')
    expect(result).not.toContain('message 3')
    expect(result).toContain('message 4')
    expect(result).toContain('message 11')
  })

  it('works correctly with empty history', () => {
    const result = buildConversationPrompt([], 'my first message')
    expect(result).toContain('my first message')
    expect(result).not.toContain('Assistant:')
  })

  it('does NOT end with an open "Assistant:" label — Ollama completes from user message', () => {
    const history: ConversationTurn[] = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' }
    ]
    const result = buildConversationPrompt(history, 'how are you?')
    expect(result.trimEnd()).not.toMatch(/Assistant:\s*$/)
  })
})

// ─── buildPrompt ─────────────────────────────────────────────────────────────

describe('buildPrompt', () => {
  const baseContext: PromptContext = {
    ccmSummary: '',
    retrievedChunks: [],
    activityState: 'BROWSING',
    activityAppName: 'Chrome',
    history: []
  }

  it('returns an object with system and conversationText fields', () => {
    const result = buildPrompt(baseContext, 'hello')
    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('conversationText')
  })

  it('system field contains the activity state from context', () => {
    const result = buildPrompt({ ...baseContext, activityState: 'STUDY', activityAppName: 'Notion' }, 'help me study')
    expect(result.system).toContain('STUDY')
  })

  it('conversationText field contains the user message', () => {
    const result = buildPrompt(baseContext, 'testing now')
    expect(result.conversationText).toContain('testing now')
  })
})

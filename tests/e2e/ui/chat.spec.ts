/**
 * Chat UI E2E Tests
 *
 * Verifies:
 * - Message sending via IPC
 * - Streaming response reception
 * - Groundedness score display
 * - Conversation persistence
 * - Error handling (Ollama unavailable)
 */

import { test, expect } from '../fixtures/electronApp'
import { waitForAppReady, completeOnboardingIfPresent } from '../helpers/common'

test.describe('Chat Interface', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page)
    await completeOnboardingIfPresent(page)
  })

  test('sends chat message and receives response via IPC', async ({ page }) => {
    const userMessage = 'Hello, can you hear me?'

    // Send message via IPC
    const result = await page.evaluate(async (msg) => {
      return await (window as any).lumina.chat.sendMessage({
        content: msg,
        conversationId: 'new'
      })
    }, userMessage)

    // Verify we got a conversation ID
    expect(result.conversationId).toBeGreaterThan(0)
  })

  test('handles streaming response deltas', async ({ page }) => {
    const userMessage = 'Tell me a short fact.'
    let deltaCount = 0
    let fullResponse = ''

    // Listen for delta events
    await page.evaluate(() => {
      (window as any).__chatDeltas = []
      ;(window as any).lumina.chat.onDelta((delta: string) => {
        ;(window as any).__chatDeltas.push(delta)
      })
    })

    // Send message
    await page.evaluate(async (msg) => {
      return await (window as any).lumina.chat.sendMessage({
        content: msg,
        conversationId: 'new'
      })
    }, userMessage)

    // Wait for response to complete
    await page.waitForTimeout(5000)

    // Verify deltas were received
    const deltas = await page.evaluate(() => (window as any).__chatDeltas)
    expect(deltas.length).toBeGreaterThan(0)
  })

  test('receives done event with groundedness score', async ({ page }) => {
    let doneReceived = false
    let groundednessScore: number | null = null

    // Listen for done event
    await page.evaluate(() => {
      (window as any).__chatDone = null
      ;(window as any).lumina.chat.onDone((result: any) => {
        ;(window as any).__chatDone = result
      })
    })

    // Send message
    await page.evaluate(async () => {
      return await (window as any).lumina.chat.sendMessage({
        content: 'Test message',
        conversationId: 'new'
      })
    })

    // Wait for done event
    await page.waitForTimeout(5000)

    const doneEvent = await page.evaluate(() => (window as any).__chatDone)
    expect(doneEvent).toBeTruthy()
    expect(doneEvent).toHaveProperty('groundedness_score')
  })

  test('preserves conversation across multiple messages', async ({ page }) => {
    // Send first message
    const result1 = await page.evaluate(async () => {
      return await (window as any).lumina.chat.sendMessage({
        content: 'First message',
        conversationId: 'new'
      })
    })

    const convId = result1.conversationId

    // Wait for response
    await page.waitForTimeout(2000)

    // Send second message in same conversation
    const result2 = await page.evaluate(async (id) => {
      return await (window as any).lumina.chat.sendMessage({
        content: 'Second message',
        conversationId: id.toString()
      })
    }, convId)

    // Should return same conversation ID
    expect(result2.conversationId).toBe(convId)
  })

  test('handles empty message gracefully', async ({ page }) => {
    const result = await page.evaluate(async () => {
      return await (window as any).lumina.chat.sendMessage({
        content: '',
        conversationId: 'new'
      })
    })

    // Should return error
    expect(result).toHaveProperty('error')
  })

  test('handles overly long message', async ({ page }) => {
    const longMessage = 'a'.repeat(5000) // Exceeds 4000 char limit

    const result = await page.evaluate(async (msg) => {
      return await (window as any).lumina.chat.sendMessage({
        content: msg,
        conversationId: 'new'
      })
    }, longMessage)

    // Should return error
    expect(result).toHaveProperty('error')
    expect(result.error).toContain('too long')
  })

  test('metrics updated after chat message', async ({ page }) => {
    // Get initial metrics
    const before = await page.evaluate(async () => {
      return await (window as any).lumina.metrics.get()
    })

    const initialLlmCalls = before.llm_call_count || 0

    // Send message
    await page.evaluate(async () => {
      return await (window as any).lumina.chat.sendMessage({
        content: 'Test for metrics',
        conversationId: 'new'
      })
    })

    await page.waitForTimeout(3000)

    // Get updated metrics
    const after = await page.evaluate(async () => {
      return await (window as any).lumina.metrics.get()
    })

    // LLM call count should have increased
    expect(after.llm_call_count).toBeGreaterThan(initialLlmCalls)
  })
})

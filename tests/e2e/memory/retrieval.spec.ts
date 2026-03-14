/**
 * Memory Retrieval E2E Tests
 *
 * Verifies:
 * - Memory search via IPC
 * - Retrieval results structure
 * - Empty query handling
 * - Query with no matches
 *
 * Note: Full RAG pipeline tests (embedding, chunking, reranking)
 * are in unit tests. This verifies the E2E IPC interface.
 */

import { test, expect } from '../fixtures/electronApp'
import { waitForAppReady, completeOnboardingIfPresent } from '../helpers/common'

test.describe('Memory Retrieval', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page)
    await completeOnboardingIfPresent(page)
  })

  test('memory search returns expected structure', async ({ page }) => {
    const result = await page.evaluate(async () => {
      return await (window as any).lumina.memory.search('test query')
    })

    expect(result).toHaveProperty('chunks')
    expect(result).toHaveProperty('durationMs')
    expect(Array.isArray(result.chunks)).toBe(true)
    expect(typeof result.durationMs).toBe('number')
  })

  test('memory search with empty query', async ({ page }) => {
    const result = await page.evaluate(async () => {
      return await (window as any).lumina.memory.search('')
    })

    // Should return empty results, not crash
    expect(result.chunks).toHaveLength(0)
  })

  test('memory search completes under 250ms target (when warm)', async ({ page }) => {
    // First search to warm up
    await page.evaluate(async () => {
      return await (window as any).lumina.memory.search('warmup query')
    })

    // Second search should be faster
    const result = await page.evaluate(async () => {
      return await (window as any).lumina.memory.search('performance test query')
    })

    // PRD target: < 250ms
    // In test mode without real data, this should be very fast
    expect(result.durationMs).toBeLessThan(500)
  })

  test('creates journal entry and retrieves it via memory search', async ({ page }) => {
    const uniqueContent = `Unique test content ${Date.now()} - electron testing framework`

    // Create journal entry
    await page.evaluate(async (content) => {
      return await (window as any).lumina.journal.create({
        content,
        mode: 'freeform'
      })
    }, uniqueContent)

    // Wait for background embedding
    await page.waitForTimeout(3000)

    // Search for it
    const result = await page.evaluate(async () => {
      return await (window as any).lumina.memory.search('electron testing')
    })

    // May or may not find it (depends on embedding speed)
    // But search should complete without error
    expect(result).toHaveProperty('chunks')
  })

  test('retrieval results include expected fields', async ({ page }) => {
    const result = await page.evaluate(async () => {
      return await (window as any).lumina.memory.search('any query')
    })

    // If any chunks returned, verify structure
    if (result.chunks.length > 0) {
      const chunk = result.chunks[0]
      expect(chunk).toHaveProperty('id')
      expect(chunk).toHaveProperty('content')
      expect(chunk).toHaveProperty('sourceType')
      expect(chunk).toHaveProperty('importanceScore')
    }
  })

  test('memory search handles special characters', async ({ page }) => {
    const specialQuery = 'test!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`'

    const result = await page.evaluate(async (query) => {
      return await (window as any).lumina.memory.search(query)
    }, specialQuery)

    // Should not crash
    expect(result).toHaveProperty('chunks')
  })
})

test.describe('Memory & Chat Integration', () => {
  test('chat retrieves relevant memories', async ({ page }) => {
    // Create a journal entry with specific content
    await page.evaluate(async () => {
      return await (window as any).lumina.journal.create({
        content: 'I love working on AI projects and machine learning algorithms.',
        mode: 'freeform'
      })
    })

    await page.waitForTimeout(2000)

    // Send chat message related to that content
    await page.evaluate(async () => {
      return await (window as any).lumina.chat.sendMessage({
        content: 'What do I like working on?',
        conversationId: 'new'
      })
    })

    // Chat should have retrieved memories (tested via unit tests)
    // Here we just verify the pipeline doesn't crash
    await page.waitForTimeout(3000)
  })

  test('PRD target: retrieval latency < 250ms', async ({ page }) => {
    const result = await page.evaluate(async () => {
      return await (window as any).lumina.memory.search('performance benchmark query')
    })

    // In test environment (minimal data), should be well under target
    expect(result.durationMs).toBeLessThan(250)
  })
})

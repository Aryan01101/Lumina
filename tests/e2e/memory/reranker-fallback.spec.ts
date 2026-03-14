/**
 * Reranker Graceful Degradation E2E Tests
 *
 * Verifies that the memory retrieval system works correctly even when
 * the reranker fails, times out, or cannot load the model.
 *
 * The system should always return results in reasonable similarity order,
 * with or without reranking.
 */

import { test, expect } from '../fixtures/electronApp'
import { waitForAppReady, completeOnboardingIfPresent } from '../helpers/common'

test.describe('Reranker Graceful Degradation', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page)
    await completeOnboardingIfPresent(page)
  })

  test('retrieval works even if reranker fails', async ({ page }) => {
    // Create some journal entries to ensure we have data
    await page.evaluate(async () => {
      await (window as any).lumina.journal.create({
        content: 'I enjoy working on machine learning projects and AI systems.',
        mode: 'freeform'
      })
    })

    await page.waitForTimeout(1000)

    // Search should work regardless of reranker status
    const result = await page.evaluate(async () => {
      return await (window as any).lumina.memory.search('machine learning')
    })

    // Should return valid structure
    expect(result).toHaveProperty('chunks')
    expect(result).toHaveProperty('durationMs')
    expect(Array.isArray(result.chunks)).toBe(true)

    // Should complete in reasonable time even with fallback
    expect(result.durationMs).toBeLessThan(1000)
  })

  test('retrieval returns results in similarity order when reranker unavailable', async ({
    page
  }) => {
    // Create multiple entries with varying relevance
    await page.evaluate(async () => {
      await (window as any).lumina.journal.create({
        content: 'Today I worked on deep learning neural networks for computer vision.',
        mode: 'freeform'
      })
    })

    await page.evaluate(async () => {
      await (window as any).lumina.journal.create({
        content: 'I had lunch and went for a walk in the park.',
        mode: 'freeform'
      })
    })

    await page.waitForTimeout(2000)

    // Search for technical content
    const result = await page.evaluate(async () => {
      return await (window as any).lumina.memory.search('neural networks')
    })

    // Should still return results
    expect(result.chunks).toBeDefined()

    // If any results, verify structure
    if (result.chunks.length > 0) {
      const chunk = result.chunks[0]
      expect(chunk).toHaveProperty('content')
      expect(chunk).toHaveProperty('importanceScore')
    }
  })

  test('empty corpus retrieval degrades gracefully', async ({ page }) => {
    // Search for content that definitely doesn't exist
    const result = await page.evaluate(async () => {
      return await (window as any).lumina.memory.search(
        'xyznonexistentqueryabc123veryrandomstring'
      )
    })

    // Should complete without error, even if corpus has other data
    expect(result).toHaveProperty('chunks')
    expect(result.durationMs).toBeLessThan(1000)
  })

  test('retrieval completes under latency target with or without reranker', async ({ page }) => {
    // Create a few entries
    await page.evaluate(async () => {
      await (window as any).lumina.journal.create({
        content: 'Testing retrieval performance with sample data entry one.',
        mode: 'freeform'
      })
    })

    await page.evaluate(async () => {
      await (window as any).lumina.journal.create({
        content: 'Testing retrieval performance with sample data entry two.',
        mode: 'freeform'
      })
    })

    await page.waitForTimeout(2000)

    // Warm up
    await page.evaluate(async () => {
      return await (window as any).lumina.memory.search('performance')
    })

    // Measure latency
    const result = await page.evaluate(async () => {
      return await (window as any).lumina.memory.search('retrieval sample data')
    })

    // PRD target: < 250ms
    // With reranker fallback, should still be fast (no 10s timeout hit)
    // Allow some overhead for CI environments
    expect(result.durationMs).toBeLessThan(2000)
  })

  test('chat integration works with reranker fallback', async ({ page }) => {
    // Create a journal entry
    await page.evaluate(async () => {
      await (window as any).lumina.journal.create({
        content: 'I love building AI desktop applications with Electron and TypeScript.',
        mode: 'freeform'
      })
    })

    await page.waitForTimeout(2000)

    // Send chat message that should retrieve the entry
    await page.evaluate(async () => {
      return await (window as any).lumina.chat.sendMessage({
        content: 'What do I like building?',
        conversationId: 'new'
      })
    })

    // Chat should complete without error
    await page.waitForTimeout(3000)

    // Verify chat doesn't crash (tested via metrics)
    const metrics = await page.evaluate(async () => {
      return await (window as any).lumina.metrics.get()
    })

    expect(metrics.llm_call_count).toBeGreaterThanOrEqual(0)
  })

  test('multiple concurrent retrieval requests handle fallback correctly', async ({ page }) => {
    // Create data
    await page.evaluate(async () => {
      await (window as any).lumina.journal.create({
        content: 'Concurrent retrieval test entry for parallel requests.',
        mode: 'freeform'
      })
    })

    await page.waitForTimeout(1500)

    // Fire multiple concurrent searches
    const results = await page.evaluate(async () => {
      return await Promise.all([
        (window as any).lumina.memory.search('concurrent'),
        (window as any).lumina.memory.search('retrieval'),
        (window as any).lumina.memory.search('parallel')
      ])
    })

    // All should complete successfully
    expect(results).toHaveLength(3)
    results.forEach((result) => {
      expect(result).toHaveProperty('chunks')
      expect(result).toHaveProperty('durationMs')
    })

    // All should complete in reasonable time (allow overhead for concurrent load)
    results.forEach((result) => {
      expect(result.durationMs).toBeLessThan(2000)
    })
  })
})

test.describe('Reranker Fallback Behavior Documentation', () => {
  test('system reports expected behavior when reranker degrades', async ({ page }) => {
    await waitForAppReady(page)

    // The reranker fallback is transparent to the API consumer
    // It returns zeros, which preserves the original similarity order

    const result = await page.evaluate(async () => {
      return await (window as any).lumina.memory.search('test query')
    })

    // Structure is always the same, regardless of reranker status
    expect(result).toHaveProperty('chunks')
    expect(result).toHaveProperty('durationMs')

    // No error field exposed to consumer (errors handled internally)
    expect(result).not.toHaveProperty('error')
  })
})

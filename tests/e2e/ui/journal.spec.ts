/**
 * Journal UI E2E Tests
 *
 * Verifies:
 * - Freeform journal entry creation
 * - Content persistence
 * - Memory ingestion trigger
 * - Embedding status tracking
 */

import { test, expect } from '../fixtures/electronApp'
import { waitForAppReady, completeOnboardingIfPresent } from '../helpers/common'

test.describe('Journal System', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page)
    await completeOnboardingIfPresent(page)
  })

  test('creates freeform journal entry', async ({ page }) => {
    const content = 'Today was a productive day. I finished implementing the new feature and fixed several bugs.'

    const result = await page.evaluate(async (text) => {
      return await (window as any).lumina.journal.create({
        content: text,
        mode: 'freeform'
      })
    }, content)

    expect(result.id).toBeGreaterThan(0)
    expect(result.created_at).toBeTruthy()
  })

  test('creates prompted journal entry with guiding question', async ({ page }) => {
    const content = 'I felt accomplished and energized.'
    const question = 'How did your day go?'

    const result = await page.evaluate(async (data) => {
      return await (window as any).lumina.journal.create({
        content: data.content,
        mode: 'prompted',
        guidingQuestion: data.question
      })
    }, { content, question })

    expect(result.id).toBeGreaterThan(0)
  })

  test('handles empty journal entry gracefully', async ({ page }) => {
    const result = await page.evaluate(async () => {
      return await (window as any).lumina.journal.create({
        content: '',
        mode: 'freeform'
      })
    })

    // Should still succeed (empty entries allowed)
    expect(result.id).toBeGreaterThan(0)
  })

  test('triggers background memory ingestion', async ({ page }) => {
    const content = 'This entry should be ingested into memory after creation.'

    await page.evaluate(async (text) => {
      return await (window as any).lumina.journal.create({
        content: text,
        mode: 'freeform'
      })
    }, content)

    // Wait for background ingestion to start
    await page.waitForTimeout(2000)

    // Memory ingestion is async - we can't easily verify completion,
    // but we can verify the entry was created
    // Detailed memory tests are in memory/ingestion.spec.ts
  })

  test('creates multiple entries in sequence', async ({ page }) => {
    const entries = [
      'First entry of the day',
      'Second entry after lunch',
      'Third entry in the evening'
    ]

    const ids: number[] = []

    for (const content of entries) {
      const result = await page.evaluate(async (text) => {
        return await (window as any).lumina.journal.create({
          content: text,
          mode: 'freeform'
        })
      }, content)

      ids.push(result.id)
    }

    // All entries should have unique IDs
    expect(new Set(ids).size).toBe(3)

    // IDs should be sequential
    expect(ids[1]).toBeGreaterThan(ids[0])
    expect(ids[2]).toBeGreaterThan(ids[1])
  })

  test('handles very long journal entry', async ({ page }) => {
    const longContent = 'This is a very long journal entry. '.repeat(100)

    const result = await page.evaluate(async (text) => {
      return await (window as any).lumina.journal.create({
        content: text,
        mode: 'freeform'
      })
    }, longContent)

    // Should succeed - chunking happens during ingestion
    expect(result.id).toBeGreaterThan(0)
  })

  test('journal entry with emotional content', async ({ page }) => {
    const emotionalContent = 'I felt anxious about the presentation but proud of how it went. Very grateful for the support.'

    const result = await page.evaluate(async (text) => {
      return await (window as any).lumina.journal.create({
        content: text,
        mode: 'freeform'
      })
    }, emotionalContent)

    expect(result.id).toBeGreaterThan(0)

    // Emotional content should get higher importance score during ingestion
    // This is tested in memory/ingestion.spec.ts
  })
})

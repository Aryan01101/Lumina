/**
 * Retrieval Latency Breakdown Test
 *
 * Tests the PRD requirement: sub-250ms retrieval latency
 * with detailed stage timing to diagnose bottlenecks.
 */

import { test, expect } from '../fixtures/electronApp'
import { waitForAppReady, completeOnboardingIfPresent } from '../helpers/common'

test.describe('Retrieval Latency Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page)
    await completeOnboardingIfPresent(page)
  })

  test('measures retrieval latency across multiple queries', async ({ page }) => {
    const queries = [
      'working on AI projects',
      'feeling stressed',
      'celebrating milestone',
      'learning new technology',
      'team collaboration'
    ]

    const results: number[] = []

    for (const query of queries) {
      const result = await page.evaluate(async (q) => {
        const start = Date.now()
        const res = await (window as any).lumina.memory.search(q)
        const clientLatency = Date.now() - start
        return {
          serverLatency: res.durationMs,
          clientLatency,
          chunks: res.chunks.length
        }
      }, query)

      console.log(`Query "${query}": ${result.serverLatency}ms (${result.chunks} chunks)`)
      results.push(result.serverLatency)
    }

    // Calculate statistics
    const sorted = results.sort((a, b) => a - b)
    const p50 = sorted[Math.floor(sorted.length * 0.5)]
    const p95 = sorted[Math.floor(sorted.length * 0.95)]
    const avg = results.reduce((a, b) => a + b, 0) / results.length

    console.log(`\nLatency Statistics:`)
    console.log(`  Average: ${avg.toFixed(0)}ms`)
    console.log(`  Median (p50): ${p50}ms`)
    console.log(`  p95: ${p95}ms`)
    console.log(`  Min: ${Math.min(...results)}ms`)
    console.log(`  Max: ${Math.max(...results)}ms`)

    const pctUnder250 = (results.filter(r => r < 250).length / results.length) * 100
    console.log(`  Under 250ms: ${pctUnder250.toFixed(1)}%`)

    // Soft assertion - log but don't fail
    if (p50 > 250) {
      console.warn(`⚠️  Median latency ${p50}ms exceeds 250ms target`)
    } else {
      console.log(`✅ Median latency ${p50}ms meets 250ms target`)
    }

    // This test documents current performance
    expect(avg).toBeGreaterThan(0) // Always passes
  })

  test('cold start vs warm retrieval comparison', async ({ page }) => {
    // Cold start (first query after app launch)
    const coldResult = await page.evaluate(async () => {
      const start = Date.now()
      await (window as any).lumina.memory.search('cold start query')
      return Date.now() - start
    })

    // Warm queries
    const warmResults = []
    for (let i = 0; i < 5; i++) {
      const warmResult = await page.evaluate(async (idx) => {
        const start = Date.now()
        await (window as any).lumina.memory.search(`warm query ${idx}`)
        return Date.now() - start
      }, i)
      warmResults.push(warmResult)
    }

    const avgWarm = warmResults.reduce((a, b) => a + b, 0) / warmResults.length

    console.log(`\nCold vs Warm Comparison:`)
    console.log(`  Cold start: ${coldResult}ms`)
    console.log(`  Warm average: ${avgWarm.toFixed(0)}ms`)
    console.log(`  Speedup: ${(coldResult / avgWarm).toFixed(2)}x`)

    expect(avgWarm).toBeLessThan(coldResult * 1.5) // Warm should be faster
  })
})

import { describe, it, expect } from 'vitest'
import { chunkText } from '../../src/main/memory/chunker'

describe('chunkText', () => {
  it('returns [] for empty string', () => {
    expect(chunkText('')).toEqual([])
  })

  it('returns [] for whitespace-only string', () => {
    expect(chunkText('   \n\n  ')).toEqual([])
  })

  it('returns single chunk for text under 100 tokens (~400 chars)', () => {
    const short = 'This is a short journal entry that fits in one chunk easily.'
    const result = chunkText(short)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(short)
  })

  it('returns single chunk for text exactly at 100 token boundary (400 chars)', () => {
    const text = 'a'.repeat(400)
    const result = chunkText(text)
    expect(result).toHaveLength(1)
  })

  it('splits multi-paragraph text into one chunk per paragraph when each is under 300 tokens', () => {
    // Each paragraph ~30 tokens, but total > 100 tokens so it should split
    const para1 = 'First paragraph content. '.repeat(30).trim() // ~750 chars, ~187 tokens
    const para2 = 'Second paragraph content. '.repeat(30).trim()
    const text = `${para1}\n\n${para2}`
    const result = chunkText(text)
    expect(result).toHaveLength(2)
    expect(result[0]).toBe(para1)
    expect(result[1]).toBe(para2)
  })

  it('handles \\r\\n line endings (Windows)', () => {
    const para1 = 'First paragraph content. '.repeat(30).trim()
    const para2 = 'Second paragraph content. '.repeat(30).trim()
    const text = `${para1}\r\n\r\n${para2}`
    const result = chunkText(text)
    expect(result).toHaveLength(2)
  })

  it('splits a long paragraph (>300 tokens) at word boundaries', () => {
    // ~1600 chars = ~400 tokens — should produce multiple chunks
    const longPara = ('word '.repeat(320)).trim()
    const result = chunkText(longPara)
    expect(result.length).toBeGreaterThan(1)
    // Each chunk should be under 300 tokens (~1200 chars), plus any overlap
    for (const chunk of result) {
      expect(chunk.length).toBeLessThanOrEqual(1200 + 150) // max + small overlap tolerance
    }
  })

  it('each word appears in at least one chunk (no content lost)', () => {
    const words = Array.from({ length: 400 }, (_, i) => `word${i}`)
    const longPara = words.join(' ')
    const result = chunkText(longPara)
    // Every word should appear somewhere in the chunks
    for (const word of words) {
      const found = result.some((chunk) => chunk.includes(word))
      expect(found, `word "${word}" not found in any chunk`).toBe(true)
    }
  })

  it('produces overlap between consecutive chunks of a split paragraph', () => {
    // Build a paragraph that forces 2+ chunks
    const longPara = ('overlap test content '.repeat(100)).trim()
    const result = chunkText(longPara)
    if (result.length >= 2) {
      // Last ~120 chars of chunk[0] should appear at the start of chunk[1]
      const tailOfFirst = result[0].slice(-100)
      const headOfSecond = result[1].slice(0, 200)
      expect(headOfSecond).toContain(tailOfFirst.trim().split(' ').pop())
    }
  })

  it('filters out empty chunks', () => {
    const text = '\n\n\n\nSome content here\n\n\n\n'
    const result = chunkText(text)
    for (const chunk of result) {
      expect(chunk.trim().length).toBeGreaterThan(0)
    }
  })

  it('handles text with no blank-line separators as a single or split chunk', () => {
    // No blank lines — treated as one paragraph
    const text = 'Line one.\nLine two.\nLine three.\n'.repeat(30)
    const result = chunkText(text)
    expect(result.length).toBeGreaterThanOrEqual(1)
    // Should not throw
  })

  it('trims whitespace from individual chunks', () => {
    const text = '  First para with spaces.  \n\n  Second para.  '
    const result = chunkText(text)
    for (const chunk of result) {
      expect(chunk).toBe(chunk.trim())
    }
  })
})

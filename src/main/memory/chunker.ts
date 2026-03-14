/**
 * Text chunker for memory ingestion pipeline.
 *
 * Splits content into chunks suitable for embedding:
 *   - Split on blank lines (paragraph boundaries)
 *   - Max 300 tokens per chunk (~1200 chars), 30-token (~120 char) overlap
 *   - Entries under 100 tokens (~400 chars) returned as a single chunk
 *   - Empty input returns []
 *
 * Token estimation: ceil(chars / 4) — within 5-10% of BPE for English prose.
 */

const MAX_TOKENS = 300
const MIN_TOKENS_SINGLE = 100
const OVERLAP_CHARS = 120 // ~30 tokens

/** Estimate token count from character length. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/** Split a long paragraph at a word boundary near the target char limit. */
function splitAtWordBoundary(text: string, maxChars: number): string[] {
  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = start + maxChars

    if (end >= text.length) {
      chunks.push(text.slice(start).trim())
      break
    }

    // Walk back to the last space within the window
    while (end > start && text[end] !== ' ') {
      end--
    }

    // No space found — force split at maxChars
    if (end === start) {
      end = start + maxChars
    }

    const chunk = text.slice(start, end).trim()
    if (chunk.length > 0) {
      chunks.push(chunk)
    }

    // Advance with overlap: next start = end - OVERLAP_CHARS
    start = Math.max(start + 1, end - OVERLAP_CHARS)
  }

  return chunks
}

/**
 * Chunk a text document into segments for embedding.
 *
 * @param content - Raw text content to chunk
 * @returns Array of chunk strings. Empty input → [].
 */
export function chunkText(content: string): string[] {
  const trimmed = content.trim()
  if (trimmed.length === 0) return []

  // Short entries stored as a single chunk
  if (estimateTokens(trimmed) <= MIN_TOKENS_SINGLE) {
    return [trimmed]
  }

  // Split on blank lines (handles \r\n and \n)
  const paragraphs = trimmed
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  if (paragraphs.length === 0) return [trimmed]

  const maxChars = MAX_TOKENS * 4 // ~1200 chars

  const chunks: string[] = []

  for (const para of paragraphs) {
    if (estimateTokens(para) <= MAX_TOKENS) {
      chunks.push(para)
    } else {
      // Paragraph exceeds limit — split at word boundaries with overlap
      chunks.push(...splitAtWordBoundary(para, maxChars))
    }
  }

  return chunks.filter((c) => c.length > 0)
}

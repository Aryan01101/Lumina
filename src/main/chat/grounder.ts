/**
 * Groundedness Scorer — Phase 6
 *
 * Async, fire-and-forget. Asks Ollama to rate how well the assistant
 * answer is supported by the retrieved chunks. Returns a 0–1 float
 * or null if scoring is unavailable.
 */

import { generate } from './ollamaClient'
import { getDb } from '../db'

const GROUNDER_MODEL = 'llama3.1:8b'

function buildGrounderPrompt(question: string, answer: string, chunks: string[]): string {
  const context = chunks.map((c, i) => `[${i + 1}] ${c}`).join('\n')
  return [
    'You are a grounding evaluator. Given a question, an answer, and source context,',
    'output a single decimal number between 0.0 and 1.0 indicating how well the answer',
    'is supported by the context. 1.0 = fully supported, 0.0 = not supported at all.',
    'Output ONLY the number. No explanation.',
    '',
    `Question: ${question}`,
    `Answer: ${answer}`,
    '',
    'Context:',
    context
  ].join('\n')
}

/**
 * Returns a groundedness score 0–1, or null if chunks are empty or
 * Ollama is unavailable.
 */
export async function scoreGroundedness(
  question: string,
  answer: string,
  chunks: string[]
): Promise<number | null> {
  if (chunks.length === 0) return null

  const result = await generate({
    model:       GROUNDER_MODEL,
    system:      'You output only a single decimal number.',
    prompt:      buildGrounderPrompt(question, answer, chunks),
    stream:      false,
    num_predict: 10
  })

  if (!result) return null

  // Log the LLM call for observability
  try {
    const db = getDb()
    db.prepare(
      `INSERT INTO llm_calls (model, prompt_tokens, completion_tokens, duration_ms, context)
       VALUES (?, ?, ?, ?, 'groundedness')`
    ).run(GROUNDER_MODEL, result.promptTokens, result.completionTokens, result.durationMs)
  } catch { /* non-critical */ }

  const match = result.fullText.trim().match(/([0-9]+(?:\.[0-9]+)?)/)
  if (!match) return null

  const score = parseFloat(match[1])
  if (isNaN(score)) return null

  return Math.min(1, Math.max(0, score))
}

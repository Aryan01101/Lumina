/**
 * Calculator Tool
 *
 * Provides safe mathematical evaluation using mathjs.
 * Supports:
 * - Basic arithmetic: +, -, *, /, ^
 * - Functions: sqrt, sin, cos, tan, log, abs, etc.
 * - Percentages: "15% of 200"
 * - Unit conversions: "5 feet to meters"
 */

import { evaluate } from 'mathjs'

export interface CalculatorResult {
  expression: string
  result: string
  error?: string
}

/**
 * Safely evaluates a mathematical expression.
 * Returns formatted result or error message.
 */
export function calculate(expression: string): CalculatorResult {
  try {
    // Clean up the expression
    const cleaned = expression
      .trim()
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/\s+/g, ' ')

    // Evaluate using mathjs (safe - no eval())
    const result = evaluate(cleaned)

    // Format result
    let formattedResult: string
    if (typeof result === 'number') {
      // Round to 10 decimal places to avoid floating point issues
      formattedResult = Number(result.toFixed(10)).toString()
    } else {
      formattedResult = String(result)
    }

    return {
      expression: cleaned,
      result: formattedResult
    }
  } catch (err) {
    return {
      expression,
      result: '',
      error: (err as Error).message
    }
  }
}

/**
 * Detects if a user message contains a calculation request.
 * Returns the expression to evaluate, or null if not a calculation.
 */
export function detectCalculation(message: string): string | null {
  const msg = message.toLowerCase().trim()

  // Patterns that indicate calculation intent
  const calcPatterns = [
    /^calculate\s+(.+)$/i,
    /^what'?s?\s+(.+)\??$/i,
    /^how much is\s+(.+)\??$/i,
    /^solve\s+(.+)$/i,
    /^(\d+[\s\+\-\*\/\^\(\)%\d\.]+\d+)$/  // Pure math expression
  ]

  for (const pattern of calcPatterns) {
    const match = msg.match(pattern)
    if (match) {
      return match[1] || match[0]
    }
  }

  // Check if message contains math operators and numbers
  const hasMathOperators = /[\+\-\*\/\^]/.test(msg)
  const hasNumbers = /\d+/.test(msg)
  const isShort = msg.length < 50

  if (hasMathOperators && hasNumbers && isShort) {
    // Extract just the math part
    const mathMatch = msg.match(/[\d\s\+\-\*\/\^\(\)\.%]+/)
    if (mathMatch) {
      return mathMatch[0].trim()
    }
  }

  return null
}

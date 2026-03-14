/**
 * Tool Router
 *
 * Analyzes user messages and routes to appropriate tool handlers.
 * Returns structured tool results that can be injected into chat context.
 */

import { detectCalculation, calculate, type CalculatorResult } from './calculator'
import { detectAlarm } from './alarms'
import type Database from 'better-sqlite3'

export type ToolType = 'calculator' | 'alarm' | 'timer' | 'schedule' | null

export interface ToolResult {
  tool: ToolType
  success: boolean
  data?: unknown
  message?: string
}

/**
 * Analyzes a user message and executes any detected tools.
 * Returns tool result or null if no tool detected.
 *
 * Note: Alarms require database access, so they're detected here but executed
 * in the chat handler where we have access to the database.
 */
export function routeTools(userMessage: string, db?: Database.Database): ToolResult | null {
  // Try calculator
  const calcExpression = detectCalculation(userMessage)
  if (calcExpression) {
    const result = calculate(calcExpression)

    if (result.error) {
      return {
        tool: 'calculator',
        success: false,
        message: `Could not calculate: ${result.error}`
      }
    }

    return {
      tool: 'calculator',
      success: true,
      data: result,
      message: `${result.expression} = ${result.result}`
    }
  }

  // Try alarm/timer (detection only - execution happens in chat handler)
  const alarmData = detectAlarm(userMessage)
  if (alarmData) {
    return {
      tool: alarmData.type,
      success: true,
      data: alarmData,
      message: `Detected ${alarmData.type} for ${alarmData.triggerAt.toLocaleString()}`
    }
  }

  // TODO: Add schedule detection

  return null
}

/**
 * Formats a tool result as context text for the LLM.
 * This gets injected into the prompt so the LLM can reference it.
 */
export function formatToolResultForContext(toolResult: ToolResult): string {
  if (!toolResult.success) {
    return `[Tool Error] ${toolResult.message}`
  }

  switch (toolResult.tool) {
    case 'calculator': {
      const data = toolResult.data as CalculatorResult
      return `[Calculator] ${data.expression} = ${data.result}`
    }

    case 'alarm':
    case 'timer': {
      const data = toolResult.data as { type: string; triggerAt: Date; message?: string }
      const timeStr = data.triggerAt.toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
      return `[${toolResult.tool === 'alarm' ? 'Alarm' : 'Timer'}] Set for ${timeStr}${data.message ? ` - ${data.message}` : ''}`
    }

    default:
      return `[${toolResult.tool}] ${toolResult.message}`
  }
}

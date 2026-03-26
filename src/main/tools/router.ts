/**
 * Tool Router
 *
 * Analyzes user messages and routes to appropriate tool handlers.
 * Returns structured tool results that can be injected into chat context.
 */

import { detectCalculation, calculate, type CalculatorResult } from './calculator'
import { detectAlarm } from './alarms'
import { createTodo, completeTodo, listTodos } from '../todos'
import type Database from 'better-sqlite3'

export type ToolType = 'calculator' | 'alarm' | 'timer' | 'schedule' | 'add_todo' | 'complete_todo' | 'list_todos' | null

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

  // Try todo operations (requires database)
  if (db) {
    // Add todo detection
    const addTodoMatch = userMessage.match(/(?:add|create|make)\s+(?:a\s+)?(?:todo|task|reminder)(?:\s+to)?\s+(.+)/i)
    if (addTodoMatch) {
      const content = addTodoMatch[1].trim()
      if (content.length > 2) {
        try {
          const id = createTodo(db, content, { aiSuggested: true })
          return {
            tool: 'add_todo',
            success: true,
            data: { id, content },
            message: `Added todo: "${content}"`
          }
        } catch (err) {
          return {
            tool: 'add_todo',
            success: false,
            message: `Could not add todo: ${(err as Error).message}`
          }
        }
      }
    }

    // List todos detection
    if (/(show|list|what are)\s+(?:my\s+)?(?:todos|tasks)/i.test(userMessage)) {
      try {
        const todos = listTodos(db, 'pending')
        return {
          tool: 'list_todos',
          success: true,
          data: { todos },
          message: todos.length > 0
            ? `You have ${todos.length} pending todo${todos.length === 1 ? '' : 's'}`
            : 'No pending todos'
        }
      } catch (err) {
        return {
          tool: 'list_todos',
          success: false,
          message: `Could not list todos: ${(err as Error).message}`
        }
      }
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

    case 'add_todo': {
      const data = toolResult.data as { id: number; content: string }
      return `[Todo Added] "${data.content}"`
    }

    case 'list_todos': {
      const data = toolResult.data as { todos: Array<{ id: number; content: string }> }
      if (data.todos.length === 0) {
        return '[Todos] No pending todos'
      }
      const todoList = data.todos.slice(0, 5).map((t, i) => `${i + 1}. ${t.content}`).join('\n')
      return `[Todos] Pending tasks:\n${todoList}${data.todos.length > 5 ? `\n... and ${data.todos.length - 5} more` : ''}`
    }

    default:
      return `[${toolResult.tool}] ${toolResult.message}`
  }
}

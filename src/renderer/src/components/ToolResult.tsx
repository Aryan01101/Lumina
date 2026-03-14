/**
 * ToolResult Component
 *
 * Displays tool execution results (calculator, alarms, schedule) in chat.
 */
import React from 'react'

interface CalculatorData {
  expression: string
  result: string
}

interface ToolResultProps {
  tool: 'calculator' | 'alarm' | 'timer' | 'schedule'
  success: boolean
  data?: unknown
  message?: string
}

export default function ToolResult({ tool, success, data, message }: ToolResultProps): React.ReactElement {
  if (!success) {
    return (
      <div className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300/90 text-xs">
        <span className="font-medium">Tool Error:</span> {message}
      </div>
    )
  }

  switch (tool) {
    case 'calculator': {
      const calcData = data as CalculatorData
      return (
        <div className="px-3 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center gap-3">
          <div className="flex-1">
            <div className="text-white/50 text-[10px] font-medium uppercase tracking-wide mb-0.5">
              Calculator
            </div>
            <div className="text-white/90 text-sm font-mono">
              {calcData.expression} <span className="text-white/40">=</span>{' '}
              <span className="text-violet-300 font-semibold">{calcData.result}</span>
            </div>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(calcData.result)
            }}
            className="px-2 py-1 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 text-violet-200 text-[10px] transition-colors"
            title="Copy result"
          >
            Copy
          </button>
        </div>
      )
    }

    case 'alarm':
    case 'timer': {
      return (
        <div className="px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="text-white/50 text-[10px] font-medium uppercase tracking-wide mb-0.5">
            {tool === 'alarm' ? 'Alarm Set' : 'Timer Set'}
          </div>
          <div className="text-white/90 text-sm">{message}</div>
        </div>
      )
    }

    case 'schedule': {
      return (
        <div className="px-3 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <div className="text-white/50 text-[10px] font-medium uppercase tracking-wide mb-0.5">
            Schedule
          </div>
          <div className="text-white/90 text-sm">{message}</div>
        </div>
      )
    }

    default:
      return (
        <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 text-xs">
          {message}
        </div>
      )
  }
}

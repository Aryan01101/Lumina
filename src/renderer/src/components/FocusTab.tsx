/**
 * Focus Tab Component
 *
 * Displays productivity features:
 * - Todo list (add, complete, delete)
 * - Active timers
 * - Session time tracking
 */
import React, { useState, useEffect, useCallback } from 'react'

interface Todo {
  id: number
  content: string
  status: 'pending' | 'completed'
  priority: number
  dueDate: string | null
  aiSuggested: boolean
  createdAt: string
  completedAt: string | null
}

interface Props {
  resetTimer: () => void
}

const PRIORITY_COLORS = ['text-white/40', 'text-yellow-400', 'text-red-400']
const PRIORITY_LABELS = ['Low', 'Med', 'High']

export default function FocusTab({ resetTimer }: Props): React.ReactElement {
  const [todos, setTodos] = useState<Todo[]>([])
  const [newTodoText, setNewTodoText] = useState('')
  const [newTodoPriority, setNewTodoPriority] = useState<number>(0)
  const [showCompleted, setShowCompleted] = useState(false)
  const [sessionMinutes, setSessionMinutes] = useState(0)
  const [currentActivity, setCurrentActivity] = useState<string>('Unknown')

  // Load todos on mount
  const loadTodos = useCallback(async () => {
    try {
      const response = await window.lumina.todos.list()
      if (response.ok && response.todos) {
        setTodos(response.todos as Todo[])
      }
    } catch (err) {
      console.error('[FocusTab] Failed to load todos:', err)
    }
  }, [])

  useEffect(() => {
    loadTodos()
  }, [loadTodos])

  // Track session time (updates every 10 seconds)
  useEffect(() => {
    const updateSession = () => {
      // This would need an IPC handler to get current session info
      // For now, we'll implement this after adding the handler
    }

    const interval = setInterval(updateSession, 10_000)
    return () => clearInterval(interval)
  }, [])

  const handleAddTodo = async () => {
    const trimmed = newTodoText.trim()
    if (trimmed.length < 2) return

    try {
      const response = await window.lumina.todos.create({
        content: trimmed,
        priority: newTodoPriority
      })

      if (response.ok) {
        setNewTodoText('')
        setNewTodoPriority(0)
        await loadTodos()
        resetTimer()
      }
    } catch (err) {
      console.error('[FocusTab] Failed to create todo:', err)
    }
  }

  const handleToggleComplete = async (todo: Todo) => {
    try {
      if (todo.status === 'pending') {
        await window.lumina.todos.complete({ id: todo.id })
      } else {
        await window.lumina.todos.uncomplete({ id: todo.id })
      }
      await loadTodos()
      resetTimer()
    } catch (err) {
      console.error('[FocusTab] Failed to toggle todo:', err)
    }
  }

  const handleDeleteTodo = async (id: number) => {
    try {
      await window.lumina.todos.delete({ id })
      await loadTodos()
      resetTimer()
    } catch (err) {
      console.error('[FocusTab] Failed to delete todo:', err)
    }
  }

  const pendingTodos = todos.filter(t => t.status === 'pending')
  const completedTodos = todos.filter(t => t.status === 'completed')
  const displayTodos = showCompleted ? todos : pendingTodos

  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-testid="focus-tab">
      {/* Session Tracker */}
      <div className="px-4 pt-3 pb-2" data-testid="focus-session-tracker">
        <div className="bg-white/5 rounded-xl px-3 py-2 border border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
              <span className="text-xs text-white/60">Current Session</span>
            </div>
            <span className="text-sm font-medium text-white/90">
              {Math.floor(sessionMinutes)}m
            </span>
          </div>
          <div className="mt-1 text-[10px] text-white/40">
            {currentActivity}
          </div>
        </div>
      </div>

      {/* Todo List Header */}
      <div className="px-4 py-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/80">
          Tasks
          {pendingTodos.length > 0 && (
            <span className="ml-2 text-xs text-white/40">
              {pendingTodos.length} pending
            </span>
          )}
        </h3>
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
        >
          {showCompleted ? 'Hide' : 'Show'} completed
        </button>
      </div>

      {/* Todo List */}
      <div className="flex-1 overflow-y-auto px-4 space-y-2 lumina-scroll" data-testid="focus-todo-list">
        {displayTodos.length === 0 && (
          <div className="py-8 text-center text-white/30 text-xs" data-testid="focus-empty-state">
            {showCompleted ? 'No todos yet' : 'No pending tasks'}
          </div>
        )}
        {displayTodos.map(todo => (
          <div
            key={todo.id}
            data-testid={`focus-todo-item-${todo.id}`}
            className={`
              flex items-start gap-2 p-2 rounded-lg bg-white/5 border border-white/10
              transition-all hover:bg-white/10
              ${todo.status === 'completed' ? 'opacity-50' : ''}
            `}
          >
            <button
              onClick={() => handleToggleComplete(todo)}
              className="flex-shrink-0 mt-0.5"
              aria-label={todo.status === 'pending' ? 'Mark complete' : 'Mark incomplete'}
              data-testid={`focus-todo-complete-${todo.id}`}
            >
              {todo.status === 'completed' ? (
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-white/30 hover:border-violet-400 transition-colors" />
              )}
            </button>

            <div className="flex-1 min-w-0">
              <p className={`
                text-sm leading-relaxed
                ${todo.status === 'completed' ? 'line-through text-white/40' : 'text-white/85'}
              `}>
                {todo.content}
              </p>
              {todo.aiSuggested && (
                <span className="inline-flex items-center gap-1 mt-1 text-[9px] text-violet-400/60">
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                  </svg>
                  AI suggested
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {todo.status === 'pending' && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded ${PRIORITY_COLORS[todo.priority]}`}>
                  {PRIORITY_LABELS[todo.priority]}
                </span>
              )}
              <button
                onClick={() => handleDeleteTodo(todo.id)}
                className="p-1 text-white/20 hover:text-red-400 transition-colors"
                aria-label="Delete todo"
                data-testid={`focus-todo-delete-${todo.id}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Todo Input */}
      <div className="px-4 py-3 border-t border-white/5" data-testid="focus-add-todo-section">
        <div className="flex gap-2 items-start">
          <input
            type="text"
            value={newTodoText}
            onChange={e => { setNewTodoText(e.target.value); resetTimer() }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleAddTodo()
              }
            }}
            placeholder="Add a task..."
            data-testid="focus-todo-input"
            className="
              flex-1 bg-white/5 border border-white/10 rounded-lg
              px-2.5 py-2 text-sm text-white/90 placeholder-white/30
              focus:outline-none focus:border-violet-400/50
              transition-colors
            "
          />
          <div className="flex gap-1" data-testid="focus-priority-buttons">
            {[0, 1, 2].map(priority => (
              <button
                key={priority}
                type="button"
                onClick={() => { setNewTodoPriority(priority); resetTimer() }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setNewTodoPriority(priority)
                    resetTimer()
                  }
                }}
                className={`
                  w-7 h-7 rounded-lg flex items-center justify-center text-[10px]
                  transition-all
                  ${newTodoPriority === priority
                    ? 'bg-violet-500/30 border-violet-400 text-violet-200'
                    : 'bg-white/5 border-white/10 text-white/30 hover:text-white/50'
                  }
                  border
                `}
                title={PRIORITY_LABELS[priority]}
                data-testid={`focus-priority-button-${priority}`}
                aria-label={`Set priority to ${PRIORITY_LABELS[priority]}`}
                aria-pressed={newTodoPriority === priority}
                tabIndex={0}
              >
                {priority + 1}
              </button>
            ))}
          </div>
          <button
            onClick={handleAddTodo}
            disabled={newTodoText.trim().length < 2}
            className="
              w-9 h-9 rounded-lg bg-violet-500 hover:bg-violet-400
              disabled:opacity-30 disabled:cursor-not-allowed
              flex items-center justify-center transition-all active:scale-95
            "
            aria-label="Add todo"
            data-testid="focus-add-todo-button"
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

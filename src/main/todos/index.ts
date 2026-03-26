/**
 * Todos Module
 *
 * Manages todo items with CRUD operations.
 * Supports AI-suggested todos and priority levels.
 */

import type Database from 'better-sqlite3'

export interface Todo {
  id: number
  content: string
  status: 'pending' | 'completed'
  priority: number  // 0=low, 1=medium, 2=high
  dueDate: string | null
  aiSuggested: boolean
  createdAt: string
  completedAt: string | null
}

/**
 * Creates a new todo item.
 */
export function createTodo(
  db: Database.Database,
  content: string,
  options?: {
    priority?: number
    dueDate?: string
    aiSuggested?: boolean
  }
): number {
  const result = db.prepare(`
    INSERT INTO todos (content, priority, due_date, ai_suggested)
    VALUES (?, ?, ?, ?)
  `).run(
    content,
    options?.priority ?? 0,
    options?.dueDate ?? null,
    options?.aiSuggested ? 1 : 0
  )

  return result.lastInsertRowid as number
}

/**
 * Lists all todos, optionally filtered by status.
 */
export function listTodos(
  db: Database.Database,
  status?: 'pending' | 'completed'
): Todo[] {
  const query = status
    ? 'SELECT * FROM todos WHERE status = ? ORDER BY priority DESC, created_at DESC'
    : 'SELECT * FROM todos ORDER BY status ASC, priority DESC, created_at DESC'

  const rows = status
    ? db.prepare(query).all(status)
    : db.prepare(query).all()

  return rows.map(mapRowToTodo)
}

/**
 * Gets a single todo by ID.
 */
export function getTodo(db: Database.Database, id: number): Todo | null {
  const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(id)
  return row ? mapRowToTodo(row) : null
}

/**
 * Marks a todo as completed.
 */
export function completeTodo(db: Database.Database, id: number): boolean {
  const result = db.prepare(`
    UPDATE todos
    SET status = 'completed', completed_at = datetime('now')
    WHERE id = ? AND status = 'pending'
  `).run(id)

  return result.changes > 0
}

/**
 * Marks a completed todo as pending again.
 */
export function uncompleteTodo(db: Database.Database, id: number): boolean {
  const result = db.prepare(`
    UPDATE todos
    SET status = 'pending', completed_at = NULL
    WHERE id = ? AND status = 'completed'
  `).run(id)

  return result.changes > 0
}

/**
 * Updates a todo's content, priority, or due date.
 */
export function updateTodo(
  db: Database.Database,
  id: number,
  updates: {
    content?: string
    priority?: number
    dueDate?: string | null
  }
): boolean {
  const fields: string[] = []
  const values: unknown[] = []

  if (updates.content !== undefined) {
    fields.push('content = ?')
    values.push(updates.content)
  }
  if (updates.priority !== undefined) {
    fields.push('priority = ?')
    values.push(updates.priority)
  }
  if (updates.dueDate !== undefined) {
    fields.push('due_date = ?')
    values.push(updates.dueDate)
  }

  if (fields.length === 0) return false

  values.push(id)
  const result = db.prepare(`
    UPDATE todos SET ${fields.join(', ')} WHERE id = ?
  `).run(...values)

  return result.changes > 0
}

/**
 * Deletes a todo.
 */
export function deleteTodo(db: Database.Database, id: number): boolean {
  const result = db.prepare('DELETE FROM todos WHERE id = ?').run(id)
  return result.changes > 0
}

/**
 * Gets counts of pending and completed todos.
 */
export function getTodoStats(db: Database.Database): {
  pending: number
  completed: number
  total: number
} {
  const row = db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      COUNT(*) as total
    FROM todos
  `).get() as { pending: number; completed: number; total: number }

  return row
}

/**
 * Maps a database row to a Todo object.
 */
function mapRowToTodo(row: unknown): Todo {
  const r = row as {
    id: number
    content: string
    status: 'pending' | 'completed'
    priority: number
    due_date: string | null
    ai_suggested: number
    created_at: string
    completed_at: string | null
  }

  return {
    id: r.id,
    content: r.content,
    status: r.status,
    priority: r.priority,
    dueDate: r.due_date,
    aiSuggested: r.ai_suggested === 1,
    createdAt: r.created_at,
    completedAt: r.completed_at
  }
}

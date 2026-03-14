import { app } from 'electron'
import { appendFileSync, mkdirSync } from 'fs'
import { join } from 'path'


function formatArgs(args: unknown[]): string {
  return args.map((a) => {
    if (typeof a === 'string') return a
    try {
      return JSON.stringify(a)
    } catch {
      return String(a)
    }
  }).join(' ')
}

export function initFileLogger(): void {
  if (process.env['LUMINA_LOG_TO_FILE'] === '0') return

  const logDir = app.getPath('logs')
  const logPath = join(logDir, 'lumina-main.log')
  mkdirSync(logDir, { recursive: true })

  const write = (level: 'INFO' | 'WARN' | 'ERROR', args: unknown[]) => {
    const line = `[${new Date().toISOString()}] ${level} ${formatArgs(args)}\n`
    try {
      appendFileSync(logPath, line, 'utf-8')
    } catch {
      // If logging fails, avoid recursion and just fall back to console.
    }
  }

  console.log = (...args: unknown[]) => {
    const line = formatArgs(args)
    write('INFO', args)
    process.stdout.write(line + '\n')
  }
  console.warn = (...args: unknown[]) => {
    const line = formatArgs(args)
    write('WARN', args)
    process.stderr.write('[WARN] ' + line + '\n')
  }
  console.error = (...args: unknown[]) => {
    const line = formatArgs(args)
    write('ERROR', args)
    process.stderr.write('[ERROR] ' + line + '\n')
  }
}


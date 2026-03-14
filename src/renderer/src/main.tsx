import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

function setupRendererLogging(): void {
  const send = (level: 'log' | 'warn' | 'error', args: unknown[]) => {
    try {
      window.lumina?.log?.send({ level, args })
    } catch {
      // ignore logging errors to avoid recursion
    }
  }

  const origLog = console.log.bind(console)
  const origWarn = console.warn.bind(console)
  const origError = console.error.bind(console)

  console.log = (...args: unknown[]) => {
    origLog(...args)
    send('log', args)
  }
  console.warn = (...args: unknown[]) => {
    origWarn(...args)
    send('warn', args)
  }
  console.error = (...args: unknown[]) => {
    origError(...args)
    send('error', args)
  }

  window.addEventListener('error', (event) => {
    send('error', [
      'window.error',
      event.message,
      event.filename,
      event.lineno,
      event.colno
    ])
  })

  window.addEventListener('unhandledrejection', (event) => {
    send('error', ['unhandledrejection', event.reason])
  })
}

setupRendererLogging()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

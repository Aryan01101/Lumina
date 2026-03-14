import { app, BrowserWindow, globalShortcut } from 'electron'
import { initDatabase, closeDatabase, getDb } from './db'
import { loadPendingAlarms } from './tools/alarms'
import { registerIpcHandlers } from './ipc'
import { createCompanionWindow } from './window'
import { startActivityMonitor, stopActivityMonitor, isDegradedMode } from './activity'
import { initMemoryEngine, retryPendingEmbeddings } from './memory'
import { terminateReranker } from './memory/reranker'
import { startAgentScheduler, stopAgentScheduler } from './agent'
import { __loadSettings, __setPersistFn } from './settings'
import { pingOllama } from './chat/ollamaClient'
import { setOllamaAvailable, isOllamaAvailable } from './systemState'
import { ElectronOllama } from 'electron-ollama'
import { initFileLogger } from './logger'

const REQUIRED_MODELS = ['nomic-embed-text', 'llama3.1:8b']

/** Streams /api/pull for one model, emitting system:pull-progress IPC events. */
async function pullModel(mainWindow: BrowserWindow, model: string): Promise<boolean> {
  console.log(`[Ollama] Pulling model: ${model}...`)
  try {
    const res = await fetch('http://127.0.0.1:11434/api/pull', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: model, stream: true })
    })
    if (!res.ok || !res.body) return false

    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let remainder = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      remainder += decoder.decode(value, { stream: true })
      const lines = remainder.split('\n')
      remainder = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const chunk = JSON.parse(line) as {
            status: string; completed?: number; total?: number
          }
          if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('system:pull-progress', {
              model,
              status:    chunk.status,
              completed: chunk.completed ?? 0,
              total:     chunk.total ?? 0,
              done:      chunk.status === 'success'
            })
          }
          if (chunk.total && chunk.completed) {
            const pct = Math.round((chunk.completed / chunk.total) * 100)
            if (pct % 10 === 0) console.log(`[Ollama] Pulling ${model}: ${pct}%`)
          }
          if (chunk.status === 'success') {
            console.log(`[Ollama] Model ready: ${model} ✓`)
            return true
          }
        } catch { /* malformed NDJSON line — skip */ }
      }
    }
    return false
  } catch (err) {
    console.error(`[Ollama] Failed to pull ${model}:`, (err as Error).message)
    return false
  }
}

/**
 * Checks all required models. Already-pulled models emit a "success" event
 * immediately. Missing models are auto-pulled with streaming progress.
 * Never throws — errors are swallowed so the app degrades gracefully.
 */
async function ensureRequiredModels(mainWindow: BrowserWindow): Promise<void> {
  try {
    const res = await fetch('http://127.0.0.1:11434/api/tags')
    if (!res.ok) return
    const data   = await res.json() as { models: { name: string }[] }
    const pulled = new Set(data.models.map((m) => m.name.split(':')[0]))

    for (const model of REQUIRED_MODELS) {
      if (pulled.has(model.split(':')[0])) {
        console.log(`[Ollama] Model ready: ${model} ✓`)
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('system:pull-progress', {
            model, status: 'success', completed: 0, total: 0, done: true
          })
        }
      } else {
        console.warn(`[Ollama] Model not found — pulling: ${model}`)
        await pullModel(mainWindow, model)
      }
    }
  } catch { /* non-critical */ }
}

let _eo: InstanceType<typeof ElectronOllama> | null = null
import { join } from 'path'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

// Prevent second instance
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  process.stderr.write('[Lumina] Another instance is already running — exiting.\n')
  app.quit()
}

function loadSettingsFromDisk(): void {
  try {
    const settingsPath = join(app.getPath('userData'), 'settings.json')
    mkdirSync(app.getPath('userData'), { recursive: true })
    const raw = readFileSync(settingsPath, 'utf-8')
    __loadSettings(JSON.parse(raw))
    __setPersistFn((s) => writeFileSync(settingsPath, JSON.stringify(s, null, 2), 'utf-8'))
  } catch {
    // File doesn't exist yet — defaults are used, persist function set for next save
    try {
      const settingsPath = join(app.getPath('userData'), 'settings.json')
      __setPersistFn((s) => writeFileSync(settingsPath, JSON.stringify(s, null, 2), 'utf-8'))
    } catch { /* no-op */ }
  }
}

function bootstrap(mainWindow: BrowserWindow): void {
  console.log('[Boot] Starting bootstrap...')

  console.log('[Boot] 1/5 Loading settings...')
  loadSettingsFromDisk()
  console.log('[Boot] 1/5 Settings loaded ✓')

  console.log('[Boot] 2/5 Initialising database...')
  initDatabase()
  loadPendingAlarms(getDb())
  console.log('[Boot] 2/5 Database ready ✓')

  console.log('[Boot] 3/5 Starting memory engine...')
  initMemoryEngine()
  console.log('[Boot] 3/5 Memory engine ready ✓')

  console.log('[Boot] 4/5 Registering IPC handlers...')
  registerIpcHandlers(mainWindow)
  console.log('[Boot] 4/5 IPC handlers registered ✓')

  console.log('[Boot] 5/5 Starting activity monitor + agent scheduler...')
  startActivityMonitor(mainWindow)
  startAgentScheduler(mainWindow)
  console.log('[Boot] 5/5 Activity monitor + scheduler started ✓')

  console.log('[Boot] Bootstrap complete ✓')
}

app.whenReady().then(() => {
  initFileLogger()
  // Disable hardware acceleration for transparent windows on some systems
  // (can cause rendering issues on Windows)
  // app.disableHardwareAcceleration()

  const mainWindow = createCompanionWindow()
  bootstrap(mainWindow)

  // Auto-start Ollama via electron-ollama; pull missing models; fall back to ping
  ;(async () => {
    console.log('[Ollama] Checking availability...')
    try {
      _eo = new ElectronOllama({ basePath: app.getPath('userData') })
      if (await _eo.isRunning()) {
        console.log('[Ollama] ✓ Existing instance detected at 127.0.0.1:11434')
      } else {
        console.log('[Ollama] No instance found — downloading/starting Ollama binary...')
        const meta = await _eo.getMetadata('latest')
        console.log(`[Ollama] Serving version ${meta.version}...`)
        await _eo.serve(meta.version, {
          serverLog: (msg) => console.log('[Ollama]', msg)
        })
        console.log('[Ollama] ✓ Started successfully')
      }
      // Pull any missing models, then mark as available
      await ensureRequiredModels(mainWindow)
      setOllamaAvailable(true)
      console.log('[Ollama] All models ready — ollamaOk=true')
      retryPendingEmbeddings()
        .then(() => console.log('[Memory] Pending embedding retry complete ✓'))
        .catch((err) => console.error('[Memory] Pending embedding retry failed:', err))
    } catch (err) {
      console.error('[Ollama] ✗ Auto-start failed:', (err as Error).message)
      const ok = await pingOllama()
      setOllamaAvailable(ok)
      console.warn(ok
        ? '[Ollama] ✓ Direct ping succeeded — using external instance'
        : '[Ollama] ✗ Unavailable — run `ollama serve` manually'
      )
    }
    // Send final status — accurate now (after models confirmed)
    const sendStatus = () => {
      if (!mainWindow.isDestroyed()) {
        const status = { ollamaOk: isOllamaAvailable(), activityDegraded: isDegradedMode() }
        console.log(`[Boot] system:status → ollamaOk=${status.ollamaOk}, activityDegraded=${status.activityDegraded}`)
        mainWindow.webContents.send('system:status', status)
      }
    }
    if (mainWindow.webContents.isLoading()) {
      mainWindow.webContents.once('did-finish-load', sendStatus)
    } else {
      sendStatus()
    }
  })()

  // Keyboard shortcut: Cmd/Ctrl+Shift+L toggles companion panel
  globalShortcut.register('CommandOrControl+Shift+L', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('shortcut:toggle-panel')
    }
  })

  // macOS: re-create window when dock icon clicked and no windows open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const win = createCompanionWindow()
      bootstrap(win)
    }
  })
})

app.on('window-all-closed', () => {
  closeDatabase()
  // On macOS, apps stay in dock until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  globalShortcut.unregisterAll()
  stopActivityMonitor()
  stopAgentScheduler()
  terminateReranker().catch(() => {})
  _eo?.getServer()?.stop().catch(() => {})
  closeDatabase()
})

import { app, BrowserWindow } from 'electron'
import { initDatabase, closeDatabase } from './db'
import { registerIpcHandlers } from './ipc'
import { createCompanionWindow } from './window'

// Prevent second instance
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

function bootstrap(mainWindow: BrowserWindow): void {
  // Initialize database (runs migrations, tries to load sqlite-vec)
  initDatabase()

  // Register all IPC handlers
  registerIpcHandlers(mainWindow)

  // Phase 3: startActivityMonitor(mainWindow)
  // Phase 7: startAgentScheduler(mainWindow)
}

app.whenReady().then(() => {
  // Disable hardware acceleration for transparent windows on some systems
  // (can cause rendering issues on Windows)
  // app.disableHardwareAcceleration()

  const mainWindow = createCompanionWindow()
  bootstrap(mainWindow)

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
  closeDatabase()
})

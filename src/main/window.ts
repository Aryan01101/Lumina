import { BrowserWindow, screen } from 'electron'
import { join } from 'path'

const COMPANION_WIDTH = 340
const COMPANION_HEIGHT = 500

let mainWindow: BrowserWindow | null = null

export function createCompanionWindow(): BrowserWindow {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

  mainWindow = new BrowserWindow({
    width: COMPANION_WIDTH,
    height: COMPANION_HEIGHT,
    // Position: bottom-right of primary display
    x: screenWidth - COMPANION_WIDTH - 20,
    y: screenHeight - COMPANION_HEIGHT - 20,
    // Overlay appearance
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    // Always above other windows
    alwaysOnTop: true,
    skipTaskbar: true,
    // Security
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false // required for preload to use require-like access
    },
    // Don't show until content is ready
    show: false,
    fullscreenable: false
  })

  // Show on macOS using 'floating' level so it stays above most windows
  // but below system UI elements
  mainWindow.setAlwaysOnTop(true, 'floating')
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false })

  // Default: click-through on transparent areas, interactive on companion
  mainWindow.setIgnoreMouseEvents(true, { forward: true })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow?.showInactive() // show without stealing focus
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

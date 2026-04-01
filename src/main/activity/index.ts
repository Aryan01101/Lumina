import { powerMonitor } from 'electron'
import type { BrowserWindow } from 'electron'
import { classify, loadConfig } from './classifier'
import { openSession, closeSession, getCurrentSessionMinutes } from './sessions'
import { getSetting } from '../settings'

export type ActivityState =
  | 'DEEP_WORK'
  | 'STUDY'
  | 'GAMING'
  | 'VIDEO_CALL'
  | 'PASSIVE_CONTENT'
  | 'BROWSING'
  | 'IDLE'
  | 'LUMINA'

export interface ActivityInfo {
  state: ActivityState
  appName: string
  startedAt: Date
}

const POLL_INTERVAL_MS = 10_000

let _currentActivity: ActivityInfo = {
  state: 'BROWSING',
  appName: 'unknown',
  startedAt: new Date()
}
let _pollTimer: ReturnType<typeof setInterval> | null = null
let _degradedMode = false
let _degradedLogged = false

export function getCurrentActivity(): ActivityInfo {
  return _currentActivity
}

export function isDegradedMode(): boolean {
  return _degradedMode
}

export function startActivityMonitor(mainWindow: BrowserWindow): void {
  if (_pollTimer) return

  const config = loadConfig()
  console.log('[Activity] Monitor started')

  openSession('unknown', 'BROWSING', '')

  const poll = async (): Promise<void> => {
    try {
      // Check if activity monitor is enabled in settings
      const monitorEnabled = getSetting('activityMonitorEnabled')

      // Skip all monitoring when disabled
      if (!monitorEnabled) {
        return
      }

      const idleSeconds = powerMonitor.getSystemIdleTime()

      // Dynamic require keeps the native module out of the test environment
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ActiveWindow } = require('@paymoapp/active-window')
      const activeWindow = ActiveWindow.getActiveWindow()

      if (!activeWindow) return

      _degradedMode = false
      _degradedLogged = false

      const appName: string = activeWindow.application ?? activeWindow.app ?? 'unknown'
      const windowTitle: string = activeWindow.title ?? ''
      const sessionMins = getCurrentSessionMinutes()

      const newState = classify(appName, windowTitle, sessionMins, idleSeconds, config)

      if (newState !== _currentActivity.state) {
        closeSession()
        openSession(appName, newState, windowTitle)

        _currentActivity = { state: newState, appName, startedAt: new Date() }

        console.log(`[Activity] → ${newState} (${appName})`)

        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('activity:state', { state: newState, appName })
        }
      }
    } catch (err: unknown) {
      if (!_degradedLogged) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[Activity] Monitor error:', msg)
        console.warn('[Activity] Degraded mode — Accessibility permission may be required on macOS')
        _degradedLogged = true
        _degradedMode = true
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('activity:degraded')
        }
      }
    }
  }

  poll()
  _pollTimer = setInterval(poll, POLL_INTERVAL_MS)

  powerMonitor.on('suspend', () => {
    if (_pollTimer) {
      clearInterval(_pollTimer)
      _pollTimer = null
      console.log('[Activity] Polling paused (system suspend)')
    }
  })

  powerMonitor.on('resume', () => {
    if (!_pollTimer) {
      poll()
      _pollTimer = setInterval(poll, POLL_INTERVAL_MS)
      console.log('[Activity] Polling resumed')
    }
  })
}

export function stopActivityMonitor(): void {
  if (_pollTimer) {
    clearInterval(_pollTimer)
    _pollTimer = null
  }
  closeSession()
  console.log('[Activity] Monitor stopped')
}

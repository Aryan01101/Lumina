/**
 * Activity Monitor — Phase 3
 *
 * Polls the active window every 10 seconds using @paymoapp/active-window,
 * classifies the app into one of 8 activity states, manages session records,
 * and pushes state changes to the renderer via IPC.
 *
 * All logic is stubbed until Phase 3.
 */

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

let _currentActivity: ActivityInfo = {
  state: 'BROWSING',
  appName: 'unknown',
  startedAt: new Date()
}

export function getCurrentActivity(): ActivityInfo {
  return _currentActivity
}

// Phase 3: start(mainWindow) — wire up @paymoapp/active-window polling
export function startActivityMonitor(_mainWindow: Electron.BrowserWindow): void {
  console.log('[Activity] Monitor placeholder — Phase 3 implementation pending')
}

export function stopActivityMonitor(): void {
  // Phase 3
}

/**
 * App Settings — Phase 8
 *
 * In-memory settings store with typed defaults and validation.
 * Persistence: JSON file at electron userData path (swappable for tests).
 *
 * IPC handlers call getSetting/setSetting directly.
 * Tests call resetSettings() in beforeEach.
 */

export interface AppSettings {
  model:                  string
  activityMonitorEnabled: boolean
  checkinFrequency:       'relaxed' | 'normal' | 'active'
  observability:          'off' | 'local' | 'langfuse'
  langfuseKey:            string
  onboardingComplete:     boolean
}

const DEFAULTS: AppSettings = {
  model:                  'llama3.1:8b',
  activityMonitorEnabled: true,
  checkinFrequency:       'normal',
  observability:          'off',
  langfuseKey:            '',
  onboardingComplete:     false
}

const VALID_CHECKIN_FREQ  = new Set<string>(['relaxed', 'normal', 'active'])
const VALID_OBSERVABILITY = new Set<string>(['off', 'local', 'langfuse'])

let _settings: AppSettings = { ...DEFAULTS }

// Swappable persistence hook — no-op in tests, file write in production
let _persistFn: (s: AppSettings) => void = () => {}

export function __setPersistFn(fn: (s: AppSettings) => void): void {
  _persistFn = fn
}

export function __loadSettings(s: Partial<AppSettings>): void {
  _settings = { ...DEFAULTS, ...s }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getSettings(): AppSettings {
  return { ..._settings }
}

export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  return _settings[key]
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  if (key === 'checkinFrequency' && !VALID_CHECKIN_FREQ.has(value as string)) {
    throw new Error(`Invalid checkinFrequency: ${String(value)}`)
  }
  if (key === 'observability' && !VALID_OBSERVABILITY.has(value as string)) {
    throw new Error(`Invalid observability: ${String(value)}`)
  }
  _settings[key] = value
  _persistFn({ ..._settings })
}

export function resetSettings(): void {
  _settings = { ...DEFAULTS }
}

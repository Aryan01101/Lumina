import { readFileSync } from 'fs'
import { join } from 'path'
import type { ActivityState } from './index'

export interface ClassifierConfig {
  exactApp: Record<string, string[]>
  wordProcessors: string[]
  deepWorkMinutes: number
  browsers: string[]
  urlPatterns: Record<string, string[]>
  titleKeywords: Record<string, string[]>
  idleSeconds: number
}

let _config: ClassifierConfig | null = null

export function loadConfig(configPath?: string): ClassifierConfig {
  if (_config) return _config

  const path = configPath ?? join(process.cwd(), 'resources/activity-classifier.json')
  const raw = readFileSync(path, 'utf-8')
  _config = JSON.parse(raw) as ClassifierConfig
  return _config
}

/** Reset cached config (used in tests to inject a custom config path). */
export function resetConfig(): void {
  _config = null
}

/**
 * Classify the active window into one of 8 activity states.
 * Pure function — no side effects, no DB calls, fully testable.
 *
 * Classification order (first match wins):
 *   1. App name is "Lumina"          → LUMINA
 *   2. Idle seconds >= threshold     → IDLE
 *   3. Exact app name match          → mapped state
 *   4. Word processor, session >= 20 min → DEEP_WORK
 *   5. Word processor, session < 20 min  → BROWSING (fail-safe)
 *   6. Known browser + URL pattern match → matched state
 *   7. Known browser, no URL match   → BROWSING
 *   8. Title keyword match           → matched state (e.g. Discord + "call")
 *   9. Default                       → BROWSING (never DEEP_WORK)
 */
export function classify(
  appName: string,
  windowTitle: string,
  sessionDurationMinutes: number,
  idleSeconds: number,
  config: ClassifierConfig
): ActivityState {
  // 1. Self-detection
  if (appName === 'Lumina' || appName === 'Electron') {
    return 'LUMINA'
  }

  // 2. Idle check (takes priority over everything else except self-detection)
  if (idleSeconds >= config.idleSeconds) {
    return 'IDLE'
  }

  // 3. Exact app name match
  for (const [state, apps] of Object.entries(config.exactApp)) {
    if (apps.some(a => a.toLowerCase() === appName.toLowerCase())) {
      return state as ActivityState
    }
  }

  // 4 & 5. Word processor with time-based DEEP_WORK promotion
  if (config.wordProcessors.some(wp => wp.toLowerCase() === appName.toLowerCase())) {
    return sessionDurationMinutes >= config.deepWorkMinutes ? 'DEEP_WORK' : 'BROWSING'
  }

  // 6 & 7. Browser with URL/content pattern matching
  const isBrowser = config.browsers.some(b => b.toLowerCase() === appName.toLowerCase())
  if (isBrowser) {
    const titleLower = windowTitle.toLowerCase()
    for (const [state, patterns] of Object.entries(config.urlPatterns)) {
      if (patterns.some(p => titleLower.includes(p.toLowerCase()))) {
        return state as ActivityState
      }
    }
    return 'BROWSING'
  }

  // 8. Title keyword match for any app (catches Discord + "call", etc.)
  const titleLower = windowTitle.toLowerCase()
  for (const [state, keywords] of Object.entries(config.titleKeywords)) {
    if (keywords.some(kw => titleLower.includes(kw.toLowerCase()))) {
      return state as ActivityState
    }
  }

  // 9. Default — fail safe toward BROWSING, never DEEP_WORK
  return 'BROWSING'
}

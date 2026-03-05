/**
 * Phase 3 — Activity Classifier Unit Tests
 *
 * Tests the pure classify() function against all logic branches
 * defined in the PRD (section 4.2, F-05).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { classify, resetConfig, loadConfig } from '../../src/main/activity/classifier'
import type { ClassifierConfig } from '../../src/main/activity/classifier'
import { hashTitle } from '../../src/main/activity/sessions'

// Minimal config matching the real resources/activity-classifier.json shape
const config: ClassifierConfig = {
  exactApp: {
    DEEP_WORK: ['Code', 'VSCode', 'Xcode', 'iTerm2', 'Terminal', 'Figma', 'Warp'],
    GAMING: ['Steam', 'Epic Games Launcher'],
    VIDEO_CALL: ['Zoom', 'zoom.us', 'Microsoft Teams', 'FaceTime'],
    PASSIVE_CONTENT: ['Spotify', 'VLC', 'IINA'],
    STUDY: ['Notion', 'Obsidian', 'Preview']
  },
  wordProcessors: ['Microsoft Word', 'Pages', 'Google Docs'],
  deepWorkMinutes: 20,
  browsers: ['Google Chrome', 'Firefox', 'Safari', 'Arc'],
  urlPatterns: {
    VIDEO_CALL: ['meet.google.com', 'teams.microsoft.com'],
    PASSIVE_CONTENT: ['youtube.com', 'youtube', 'netflix.com', 'netflix', 'twitch.tv', 'twitch', 'spotify.com'],
    STUDY: ['arxiv.org', 'arxiv', 'coursera.org', 'coursera', 'khanacademy.org', 'udemy.com']
  },
  titleKeywords: {
    VIDEO_CALL: ['call', 'meeting', 'conference']
  },
  idleSeconds: 300
}

beforeEach(() => {
  resetConfig()
})

describe('Classifier — exact app matches', () => {
  it('VSCode → DEEP_WORK', () => {
    expect(classify('VSCode', '', 0, 0, config)).toBe('DEEP_WORK')
  })

  it('Code (VS Code on macOS) → DEEP_WORK', () => {
    expect(classify('Code', 'main.ts - my-project', 0, 0, config)).toBe('DEEP_WORK')
  })

  it('Figma → DEEP_WORK', () => {
    expect(classify('Figma', 'My Design', 0, 0, config)).toBe('DEEP_WORK')
  })

  it('Steam → GAMING', () => {
    expect(classify('Steam', '', 0, 0, config)).toBe('GAMING')
  })

  it('Zoom → VIDEO_CALL', () => {
    expect(classify('Zoom', 'Zoom Meeting', 0, 0, config)).toBe('VIDEO_CALL')
  })

  it('FaceTime → VIDEO_CALL', () => {
    expect(classify('FaceTime', '', 0, 0, config)).toBe('VIDEO_CALL')
  })

  it('Spotify → PASSIVE_CONTENT', () => {
    expect(classify('Spotify', '', 0, 0, config)).toBe('PASSIVE_CONTENT')
  })

  it('Notion → STUDY', () => {
    expect(classify('Notion', '', 0, 0, config)).toBe('STUDY')
  })

  it('Obsidian → STUDY', () => {
    expect(classify('Obsidian', 'My Vault', 0, 0, config)).toBe('STUDY')
  })
})

describe('Classifier — self-detection and idle', () => {
  it('Lumina app name → LUMINA', () => {
    expect(classify('Lumina', '', 0, 0, config)).toBe('LUMINA')
  })

  it('Electron (dev mode) → LUMINA', () => {
    expect(classify('Electron', '', 0, 0, config)).toBe('LUMINA')
  })

  it('LUMINA check runs before idle check', () => {
    expect(classify('Lumina', '', 0, 9999, config)).toBe('LUMINA')
  })

  it('idle seconds >= threshold → IDLE', () => {
    expect(classify('Safari', '', 0, 300, config)).toBe('IDLE')
  })

  it('idle seconds exactly at threshold → IDLE', () => {
    expect(classify('Firefox', 'some page', 0, 300, config)).toBe('IDLE')
  })

  it('idle seconds below threshold → not IDLE', () => {
    expect(classify('Safari', '', 0, 299, config)).not.toBe('IDLE')
  })

  it('IDLE check runs before exact app match', () => {
    // Even a known DEEP_WORK app becomes IDLE if user is idle
    expect(classify('VSCode', '', 0, 500, config)).toBe('IDLE')
  })
})

describe('Classifier — word processors (time-based promotion)', () => {
  it('Microsoft Word, session < 20 min → BROWSING (fail-safe)', () => {
    expect(classify('Microsoft Word', 'Document.docx', 5, 0, config)).toBe('BROWSING')
  })

  it('Microsoft Word, session = 0 min → BROWSING', () => {
    expect(classify('Microsoft Word', 'Document.docx', 0, 0, config)).toBe('BROWSING')
  })

  it('Microsoft Word, session = 20 min → DEEP_WORK', () => {
    expect(classify('Microsoft Word', 'Document.docx', 20, 0, config)).toBe('DEEP_WORK')
  })

  it('Microsoft Word, session > 20 min → DEEP_WORK', () => {
    expect(classify('Microsoft Word', 'Document.docx', 45, 0, config)).toBe('DEEP_WORK')
  })

  it('Pages (Apple word processor) also follows the same rule', () => {
    expect(classify('Pages', 'Essay.pages', 25, 0, config)).toBe('DEEP_WORK')
  })
})

describe('Classifier — browser URL pattern matching', () => {
  it('Safari + youtube.com in title → PASSIVE_CONTENT', () => {
    expect(classify('Safari', 'YouTube - My Video', 0, 0, config)).toBe('PASSIVE_CONTENT')
  })

  it('Chrome + netflix.com in title → PASSIVE_CONTENT', () => {
    expect(classify('Google Chrome', 'Netflix - Watch Online', 0, 0, config)).toBe('PASSIVE_CONTENT')
  })

  it('Firefox + arxiv.org in title → STUDY', () => {
    expect(classify('Firefox', 'arxiv.org - Deep Learning Paper', 0, 0, config)).toBe('STUDY')
  })

  it('Arc + coursera.org in title → STUDY', () => {
    expect(classify('Arc', 'Coursera | Learn Python', 0, 0, config)).toBe('STUDY')
  })

  it('Safari + meet.google.com in title → VIDEO_CALL', () => {
    expect(classify('Safari', 'meet.google.com/abc-def-ghi', 0, 0, config)).toBe('VIDEO_CALL')
  })

  it('Chrome with no matching URL → BROWSING', () => {
    expect(classify('Google Chrome', 'New Tab', 0, 0, config)).toBe('BROWSING')
  })

  it('URL matching is case-insensitive', () => {
    expect(classify('Safari', 'YouTube.com - Video', 0, 0, config)).toBe('PASSIVE_CONTENT')
  })
})

describe('Classifier — title keyword matching', () => {
  it('Discord + "call" in title → VIDEO_CALL', () => {
    expect(classify('Discord', 'Call with teammates', 0, 0, config)).toBe('VIDEO_CALL')
  })

  it('Discord + "meeting" in title → VIDEO_CALL', () => {
    expect(classify('Discord', 'Team meeting in progress', 0, 0, config)).toBe('VIDEO_CALL')
  })

  it('Discord without call keyword → BROWSING (default)', () => {
    expect(classify('Discord', 'general - My Server', 0, 0, config)).toBe('BROWSING')
  })

  it('Keyword matching is case-insensitive', () => {
    expect(classify('Discord', 'MEETING with Alice', 0, 0, config)).toBe('VIDEO_CALL')
  })
})

describe('Classifier — default fallback', () => {
  it('completely unknown app → BROWSING (never DEEP_WORK)', () => {
    expect(classify('SomeRandomApp', 'Some Window', 0, 0, config)).toBe('BROWSING')
  })

  it('empty app name → BROWSING', () => {
    expect(classify('', '', 0, 0, config)).toBe('BROWSING')
  })
})

describe('Classifier — config file loading', () => {
  it('loadConfig reads the real JSON file without error', () => {
    const realConfig = loadConfig()
    expect(realConfig).toBeDefined()
    expect(realConfig.exactApp).toBeDefined()
    expect(realConfig.browsers).toBeInstanceOf(Array)
    expect(realConfig.idleSeconds).toBeGreaterThan(0)
    expect(realConfig.deepWorkMinutes).toBe(20)
  })
})

describe('Session utilities — SHA-256 title hashing', () => {
  it('produces a 64-character hex string', () => {
    const hash = hashTitle('My Secret Window Title')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })

  it('same title always produces the same hash', () => {
    expect(hashTitle('Hello')).toBe(hashTitle('Hello'))
  })

  it('different titles produce different hashes', () => {
    expect(hashTitle('Title A')).not.toBe(hashTitle('Title B'))
  })

  it('handles empty string', () => {
    const hash = hashTitle('')
    expect(hash).toHaveLength(64)
  })
})

/**
 * Time Parser Utility
 *
 * Parses natural language time expressions into Date objects.
 */

/**
 * Parses relative time like "5 minutes", "2 hours", "30 seconds".
 * Returns Date object for when the time will occur, or null if invalid.
 */
export function parseRelativeTime(timeStr: string): Date | null {
  const patterns = [
    { regex: /(\d+)\s*(?:second|sec)s?/i, unit: 1000 },
    { regex: /(\d+)\s*(?:minute|min)s?/i, unit: 60 * 1000 },
    { regex: /(\d+)\s*(?:hour|hr)s?/i, unit: 60 * 60 * 1000 }
  ]

  for (const { regex, unit } of patterns) {
    const match = timeStr.match(regex)
    if (match) {
      const amount = parseInt(match[1], 10)
      if (!isNaN(amount) && amount > 0) {
        const now = new Date()
        return new Date(now.getTime() + amount * unit)
      }
    }
  }

  return null
}

/**
 * Parses absolute time like "3pm", "15:30", "tomorrow at 9am".
 * Returns Date object or null if invalid.
 */
export function parseAbsoluteTime(timeStr: string): Date | null {
  const now = new Date()
  const str = timeStr.toLowerCase().trim()

  // Parse "3pm", "3:30pm", "15:30"
  const timeMatch = str.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/)
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10)
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0
    const period = timeMatch[3]

    if (period === 'pm' && hours < 12) hours += 12
    if (period === 'am' && hours === 12) hours = 0

    const target = new Date(now)
    target.setHours(hours, minutes, 0, 0)

    // If time has passed today, schedule for tomorrow
    if (target <= now) {
      target.setDate(target.getDate() + 1)
    }

    return target
  }

  // Parse "tomorrow at X"
  if (str.includes('tomorrow')) {
    const tomorrowTimeMatch = str.match(/tomorrow.*?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/)
    if (tomorrowTimeMatch) {
      let hours = parseInt(tomorrowTimeMatch[1], 10)
      const minutes = tomorrowTimeMatch[2] ? parseInt(tomorrowTimeMatch[2], 10) : 0
      const period = tomorrowTimeMatch[3]

      if (period === 'pm' && hours < 12) hours += 12
      if (period === 'am' && hours === 12) hours = 0

      const target = new Date(now)
      target.setDate(target.getDate() + 1)
      target.setHours(hours, minutes, 0, 0)

      return target
    }
  }

  return null
}

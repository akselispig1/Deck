import { format } from 'date-fns'

// A stable id. crypto.randomUUID is available in every browser Deck targets.
export function newId(): string {
  return crypto.randomUUID()
}

export function toISO(d: Date): string {
  return d.toISOString()
}

// "08:15" -> minutes from midnight
export function timeStringToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function minutesToTimeString(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ---- Display formatting ----

export function formatDayName(d: Date): string {
  return format(d, 'EEEE') // "Thursday"
}

export function formatDayNumber(d: Date): string {
  return format(d, 'd') // "14"
}

export function formatMonth(d: Date): string {
  return format(d, 'MMMM') // "August"
}

export function formatTime(d: Date | string): string {
  return format(typeof d === 'string' ? new Date(d) : d, 'HH:mm')
}

export function formatTimeRange(start: Date | string, end: Date | string): string {
  return `${formatTime(start)} – ${formatTime(end)}`
}

// "due Fri 15 Aug" style, used in Google event descriptions and chips
export function formatShortDate(d: Date | string): string {
  return format(typeof d === 'string' ? new Date(d) : d, 'EEE d MMM')
}

// 40 -> "40m", 60 -> "1h", 80 -> "1h 20m", 120 -> "2h"
export function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

// mm:ss remaining, used by the Now card countdown
export function formatCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.floor(msRemaining / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function minutesBetween(start: string, end: string): number {
  return Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 60000,
  )
}

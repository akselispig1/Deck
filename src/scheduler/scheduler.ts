import { addDays, addMinutes, differenceInCalendarDays, startOfDay, subDays } from 'date-fns'
import type { Availability } from '../types'
import { timeStringToMinutes, toISO } from '../lib/time'

// The scheduler is a pure function: given tasks, availability and the blocks
// already on the calendar, it returns proposed blocks plus whatever couldn't be
// placed. No side effects, no ids, no persistence — see build spec §5.

export interface SchedulerSettings {
  blockLengthMinutes: number
  maxBlocksPerEvening: number
  bufferDays: number
}

export interface SchedulableTask {
  id: string
  dueAt: string // ISO
  estMinutes: number
  createdAt: string // ISO — tie-breaker when due dates match
}

export interface OccupiedBlock {
  start: string // ISO
  end: string // ISO
}

export interface ProposedBlock {
  taskId: string
  start: string // ISO
  end: string // ISO
}

export interface UnscheduledChunk {
  taskId: string
  minutes: number
}

export interface SchedulerInput {
  tasks: SchedulableTask[]
  availability: Availability[]
  existingBlocks: OccupiedBlock[]
  settings: SchedulerSettings
  now: Date
  // Hard stop so a malformed far-future due date can't loop forever.
  horizonDays?: number
}

export interface SchedulerResult {
  blocks: ProposedBlock[]
  unscheduled: UnscheduledChunk[]
}

const NEVER_SHORTER_THAN = 15 // never create a chunk under 15 min (§5.2)
const ALIGN = 5 // place block starts on tidy 5-minute boundaries
const MINUTES_IN_DAY = 24 * 60

// Split an estimate into work chunks. The last chunk may be shorter, but a
// remainder under 15 minutes is folded back into the previous chunk.
export function chunkMinutes(total: number, blockLength: number): number[] {
  if (total <= 0) return []
  const size = Math.max(1, Math.floor(blockLength))
  const chunks: number[] = []
  let remaining = Math.round(total)
  while (remaining > 0) {
    const c = Math.min(size, remaining)
    chunks.push(c)
    remaining -= c
  }
  if (chunks.length > 1 && chunks[chunks.length - 1] < NEVER_SHORTER_THAN) {
    const tail = chunks.pop() as number
    chunks[chunks.length - 1] += tail
  }
  return chunks
}

interface Interval {
  start: number // minutes from midnight
  end: number
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function ceilTo(n: number, step: number): number {
  return Math.ceil(n / step) * step
}

// The availability windows that apply to a given weekday, as minute intervals.
function availabilityIntervals(availability: Availability[], date: Date): Interval[] {
  const dow = date.getDay()
  const out: Interval[] = []
  for (const a of availability) {
    if (!a.daysOfWeek.includes(dow)) continue
    const start = timeStringToMinutes(a.startTime)
    const end = timeStringToMinutes(a.endTime)
    if (end > start) out.push({ start, end })
  }
  return out
}

// Merge overlapping/touching intervals into a minimal sorted set.
function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return []
  const sorted = [...intervals].sort((a, b) => a.start - b.start)
  const merged: Interval[] = [{ ...sorted[0] }]
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]
    const cur = sorted[i]
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end)
    } else {
      merged.push({ ...cur })
    }
  }
  return merged
}

// Free gaps within [lower, upper) once the busy intervals are removed.
function freeGaps(busy: Interval[], lower: number, upper: number): Interval[] {
  const gaps: Interval[] = []
  let cursor = lower
  for (const b of busy) {
    if (b.end <= lower || b.start >= upper) continue
    const bs = Math.max(b.start, lower)
    if (bs > cursor) gaps.push({ start: cursor, end: bs })
    cursor = Math.max(cursor, Math.min(b.end, upper))
  }
  if (cursor < upper) gaps.push({ start: cursor, end: upper })
  return gaps
}

export function schedule(input: SchedulerInput): SchedulerResult {
  const { availability, existingBlocks, settings, now } = input
  const horizonDays = input.horizonDays ?? 120
  const { blockLengthMinutes, maxBlocksPerEvening, bufferDays } = settings

  // Mutable per-day model, seeded from the blocks already on the calendar.
  // Both their time (busy) and their number (count toward the per-day cap).
  const committed = new Map<string, Interval[]>()
  const counts = new Map<string, number>()

  const dayStart0 = startOfDay(now)

  for (const b of existingBlocks) {
    const s = new Date(b.start)
    const e = new Date(b.end)
    const key = dayKey(s)
    const sMin = s.getHours() * 60 + s.getMinutes()
    // Clamp to end of day if a block somehow runs past midnight.
    const sameDayEnd =
      dayKey(e) === key ? e.getHours() * 60 + e.getMinutes() : MINUTES_IN_DAY
    const list = committed.get(key) ?? []
    list.push({ start: sMin, end: sameDayEnd })
    committed.set(key, list)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  // Earliest instant we may place anything: now, rounded up to the grid.
  const nowMinutes = ceilTo(now.getHours() * 60 + now.getMinutes(), ALIGN)

  // Earliest-deadline-first; createdAt then id break ties deterministically.
  const tasks = [...input.tasks].sort((a, b) => {
    const d = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    if (d !== 0) return d
    const c = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    if (c !== 0) return c
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })

  const blocks: ProposedBlock[] = []
  const unscheduled: UnscheduledChunk[] = []

  for (const task of tasks) {
    const due = new Date(task.dueAt)

    // Work backwards from the deadline, leaving bufferDays clear before it.
    // buffer 0 -> may work right up to the due moment; buffer N -> the last
    // workable day is N days before the due day (the due day itself is clear).
    const lastWorkDay = subDays(startOfDay(due), bufferDays)
    const lastDayOffset = differenceInCalendarDays(lastWorkDay, dayStart0)
    const latestEndMinutes =
      bufferDays === 0 ? due.getHours() * 60 + due.getMinutes() : MINUTES_IN_DAY

    const chunks = chunkMinutes(task.estMinutes, blockLengthMinutes)

    for (const len of chunks) {
      let placed = false
      const maxOffset = Math.min(lastDayOffset, horizonDays)

      for (let offset = 0; offset <= maxOffset && !placed; offset++) {
        const date = addDays(dayStart0, offset)
        const key = dayKey(date)

        if ((counts.get(key) ?? 0) >= maxBlocksPerEvening) continue

        const lower = offset === 0 ? nowMinutes : 0
        const isLastDay = offset === lastDayOffset
        const upper = isLastDay ? latestEndMinutes : MINUTES_IN_DAY
        if (lower >= upper) continue

        const busy = mergeIntervals([
          ...availabilityIntervals(availability, date),
          ...(committed.get(key) ?? []),
        ])
        const gaps = freeGaps(busy, lower, upper)

        for (const gap of gaps) {
          const start = ceilTo(gap.start, ALIGN)
          if (start + len <= gap.end) {
            const startDate = addMinutes(date, start)
            const endDate = addMinutes(startDate, len)
            blocks.push({ taskId: task.id, start: toISO(startDate), end: toISO(endDate) })

            const list = committed.get(key) ?? []
            list.push({ start, end: start + len })
            committed.set(key, list)
            counts.set(key, (counts.get(key) ?? 0) + 1)

            placed = true
            break
          }
        }
      }

      if (!placed) unscheduled.push({ taskId: task.id, minutes: len })
    }
  }

  return { blocks, unscheduled }
}

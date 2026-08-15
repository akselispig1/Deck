import { describe, expect, it } from 'vitest'
import { addDays } from 'date-fns'
import type { Availability } from '../types'
import {
  chunkMinutes,
  schedule,
  type SchedulableTask,
  type SchedulerSettings,
} from './scheduler'

// A fixed Monday afternoon so every test is deterministic regardless of the
// machine's clock. new Date(year, monthIndex, day, hour, minute) is local time.
const MONDAY_3PM = new Date(2025, 0, 6, 15, 0) // Mon 6 Jan 2025, 15:00

const AVAILABILITY: Availability[] = [
  { id: 'sleep-am', label: 'Sleep', daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startTime: '00:00', endTime: '07:30' },
  { id: 'sleep-pm', label: 'Wind down', daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startTime: '21:30', endTime: '23:59' },
  { id: 'school', label: 'School', daysOfWeek: [1, 2, 3, 4, 5], startTime: '08:15', endTime: '15:30' },
]

const SETTINGS: SchedulerSettings = {
  blockLengthMinutes: 40,
  maxBlocksPerEvening: 3,
  bufferDays: 1,
}

function iso(offsetDays: number, h: number, m: number): string {
  const d = addDays(MONDAY_3PM, offsetDays)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

function task(partial: Partial<SchedulableTask> & { id: string }): SchedulableTask {
  return {
    dueAt: iso(3, 8, 15),
    estMinutes: 40,
    createdAt: MONDAY_3PM.toISOString(),
    ...partial,
  }
}

function overlaps(aS: string, aE: string, bS: number, bE: number, day: Date): boolean {
  const s = new Date(aS)
  const e = new Date(aE)
  const dayMin = (x: Date) => x.getHours() * 60 + x.getMinutes()
  // only compare when on the same calendar day
  if (s.toDateString() !== day.toDateString()) return false
  return dayMin(s) < bE && bS < dayMin(e)
}

describe('chunkMinutes', () => {
  it('splits evenly when the estimate is a multiple of the block length', () => {
    expect(chunkMinutes(120, 40)).toEqual([40, 40, 40])
    expect(chunkMinutes(200, 40)).toEqual([40, 40, 40, 40, 40])
  })

  it('keeps a trailing chunk of 15 minutes or more', () => {
    expect(chunkMinutes(100, 40)).toEqual([40, 40, 20])
  })

  it('folds a trailing chunk under 15 minutes into the previous one', () => {
    expect(chunkMinutes(85, 40)).toEqual([40, 45])
    expect(chunkMinutes(50, 40)).toEqual([50])
  })

  it('never folds a lone chunk, even if it is under 15 minutes', () => {
    expect(chunkMinutes(40, 40)).toEqual([40])
    expect(chunkMinutes(30, 40)).toEqual([30])
    expect(chunkMinutes(15, 40)).toEqual([15])
    expect(chunkMinutes(10, 40)).toEqual([10])
  })

  it('returns nothing for a zero or negative estimate', () => {
    expect(chunkMinutes(0, 40)).toEqual([])
    expect(chunkMinutes(-30, 40)).toEqual([])
  })
})

describe('schedule', () => {
  it('places a task in the first free slot after now', () => {
    const res = schedule({
      tasks: [task({ id: 't1', estMinutes: 40 })],
      availability: AVAILABILITY,
      existingBlocks: [],
      settings: SETTINGS,
      now: MONDAY_3PM,
    })
    expect(res.unscheduled).toEqual([])
    expect(res.blocks).toHaveLength(1)
    // School runs to 15:30, so the first placeable slot is 15:30.
    expect(res.blocks[0].start).toBe(iso(0, 15, 30))
    expect(res.blocks[0].end).toBe(iso(0, 16, 10))
  })

  it('never places a block inside an availability window', () => {
    const res = schedule({
      tasks: [task({ id: 'big', estMinutes: 240, dueAt: iso(6, 8, 0) })],
      availability: AVAILABILITY,
      existingBlocks: [],
      settings: SETTINGS,
      now: MONDAY_3PM,
    })
    for (const b of res.blocks) {
      for (let d = 0; d <= 6; d++) {
        const day = addDays(MONDAY_3PM, d)
        // must not intersect sleep, wind-down, or (weekday) school
        expect(overlaps(b.start, b.end, 0, 450, day)).toBe(false) // 00:00–07:30
        expect(overlaps(b.start, b.end, 1290, 1440, day)).toBe(false) // 21:30–24:00
        const dow = day.getDay()
        if (dow >= 1 && dow <= 5) {
          expect(overlaps(b.start, b.end, 495, 930, day)).toBe(false) // 08:15–15:30
        }
      }
    }
  })

  it('never exceeds maxBlocksPerEvening on a single day', () => {
    const res = schedule({
      tasks: [task({ id: 'wide', estMinutes: 200, dueAt: iso(6, 8, 0) })],
      availability: AVAILABILITY,
      existingBlocks: [],
      settings: SETTINGS,
      now: MONDAY_3PM,
    })
    expect(res.blocks).toHaveLength(5)
    const perDay = new Map<string, number>()
    for (const b of res.blocks) {
      const k = new Date(b.start).toDateString()
      perDay.set(k, (perDay.get(k) ?? 0) + 1)
    }
    for (const n of perDay.values()) expect(n).toBeLessThanOrEqual(3)
    // exactly 3 land on Monday, the rest spill to Tuesday
    expect(perDay.get(MONDAY_3PM.toDateString())).toBe(3)
  })

  it('gives earlier deadlines first claim on earlier slots', () => {
    const res = schedule({
      tasks: [
        task({ id: 'later', estMinutes: 40, dueAt: iso(5, 8, 0) }),
        task({ id: 'sooner', estMinutes: 40, dueAt: iso(3, 8, 0) }),
      ],
      availability: AVAILABILITY,
      existingBlocks: [],
      settings: SETTINGS,
      now: MONDAY_3PM,
    })
    const sooner = res.blocks.find((b) => b.taskId === 'sooner')!
    const later = res.blocks.find((b) => b.taskId === 'later')!
    expect(sooner.start).toBe(iso(0, 15, 30))
    expect(later.start).toBe(iso(0, 16, 10))
  })

  it('leaves bufferDays clear before the deadline', () => {
    // Due today with a 1-day buffer -> the last workable day was yesterday,
    // which is in the past, so it cannot be placed.
    const res = schedule({
      tasks: [task({ id: 'due-today', estMinutes: 40, dueAt: iso(0, 20, 0) })],
      availability: AVAILABILITY,
      existingBlocks: [],
      settings: SETTINGS,
      now: MONDAY_3PM,
    })
    expect(res.blocks).toHaveLength(0)
    expect(res.unscheduled).toEqual([{ taskId: 'due-today', minutes: 40 }])
  })

  it('with a zero buffer, may work right up to the due moment', () => {
    const res = schedule({
      tasks: [task({ id: 'today0', estMinutes: 40, dueAt: iso(0, 18, 0) })],
      availability: AVAILABILITY,
      existingBlocks: [],
      settings: { ...SETTINGS, bufferDays: 0 },
      now: MONDAY_3PM,
    })
    expect(res.blocks).toHaveLength(1)
    expect(res.blocks[0].start).toBe(iso(0, 15, 30))
  })

  it('treats existing blocks as busy and counts them toward the cap', () => {
    const res = schedule({
      tasks: [task({ id: 'avoid', estMinutes: 40, dueAt: iso(4, 8, 0) })],
      availability: AVAILABILITY,
      existingBlocks: [{ start: iso(0, 15, 30), end: iso(0, 16, 10) }],
      settings: SETTINGS,
      now: MONDAY_3PM,
    })
    expect(res.blocks).toHaveLength(1)
    // 15:30–16:10 is taken, so the next block starts at 16:10
    expect(res.blocks[0].start).toBe(iso(0, 16, 10))
  })

  it('returns unplaced chunks as unscheduled when the day is already full', () => {
    // Three existing blocks fill Monday's cap; the task is only workable Monday.
    const res = schedule({
      tasks: [task({ id: 'nope', estMinutes: 40, dueAt: iso(1, 8, 0) })],
      availability: AVAILABILITY,
      existingBlocks: [
        { start: iso(0, 15, 30), end: iso(0, 16, 10) },
        { start: iso(0, 16, 10), end: iso(0, 16, 50) },
        { start: iso(0, 16, 50), end: iso(0, 17, 30) },
      ],
      settings: SETTINGS,
      now: MONDAY_3PM,
    })
    expect(res.blocks).toHaveLength(0)
    expect(res.unscheduled).toEqual([{ taskId: 'nope', minutes: 40 }])
  })

  it('schedules what fits and reports the rest', () => {
    // Due tomorrow with a 1-day buffer -> only Monday is workable, whose cap is
    // 3 blocks. The task needs 6, so 3 are placed and 3 come back unscheduled.
    const res = schedule({
      tasks: [task({ id: 'partial', estMinutes: 240, dueAt: iso(1, 8, 0) })],
      availability: AVAILABILITY,
      existingBlocks: [],
      settings: SETTINGS,
      now: MONDAY_3PM,
    })
    expect(res.blocks).toHaveLength(3) // Monday's cap
    expect(res.unscheduled).toHaveLength(3)
    expect(res.unscheduled.every((u) => u.taskId === 'partial')).toBe(true)
  })
})

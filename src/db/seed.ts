import { addDays, set, startOfDay } from 'date-fns'
import type { Availability, Block, Course, Task } from '../types'
import { db } from './db'
import { newId, toISO } from '../lib/time'

// Seed data is generated relative to *today* so a fresh install always opens
// on something useful rather than a dead calendar. Runs once, only when the
// database is empty.

function at(base: Date, hours: number, minutes: number): Date {
  return set(base, { hours, minutes, seconds: 0, milliseconds: 0 })
}

export async function seedIfEmpty(): Promise<boolean> {
  const count = await db.tasks.count()
  if (count > 0) return false

  const now = new Date()
  const today = startOfDay(now)

  const courses: Course[] = [
    { id: 'c-chem', name: 'MYP Chemistry', short: 'Chem', teacher: 'Ms Okafor', colorKey: 'school' },
    { id: 'c-math', name: 'MYP Mathematics', short: 'Maths', teacher: 'Mr Doyle', colorKey: 'school' },
    { id: 'c-ger', name: 'MYP German', short: 'German', teacher: 'Frau Weiss', colorKey: 'school' },
    { id: 'c-hist', name: 'MYP History', short: 'History', teacher: 'Ms Bianchi', colorKey: 'school' },
    { id: 'c-eng', name: 'MYP English', short: 'English', teacher: 'Mr Adeyemi', colorKey: 'school' },
  ]

  const tasks: Task[] = [
    {
      id: newId(),
      title: 'Chemistry criterion B write-up',
      courseId: 'c-chem',
      lane: 'school',
      type: 'summative',
      dueAt: toISO(at(addDays(today, 2), 15, 30)),
      estMinutes: 120,
      status: 'open',
      createdAt: toISO(now),
    },
    {
      id: newId(),
      title: 'German vocab — Kapitel 4',
      courseId: 'c-ger',
      lane: 'school',
      type: 'homework',
      dueAt: toISO(at(addDays(today, 2), 8, 15)),
      estMinutes: 40,
      status: 'open',
      createdAt: toISO(now),
    },
    {
      id: newId(),
      title: 'CharQ landing-page costings',
      lane: 'charq',
      type: 'admin',
      dueAt: toISO(at(addDays(today, 3), 18, 0)),
      estMinutes: 40,
      status: 'open',
      createdAt: toISO(now),
    },
    {
      id: newId(),
      title: 'Design portfolio — client revisions',
      lane: 'freelance',
      type: 'homework',
      dueAt: toISO(at(addDays(today, 4), 17, 0)),
      estMinutes: 120,
      status: 'open',
      createdAt: toISO(now),
    },
    {
      id: newId(),
      title: 'History revision — causes of WWI',
      courseId: 'c-hist',
      lane: 'school',
      type: 'revision',
      dueAt: toISO(at(addDays(today, 6), 8, 15)),
      estMinutes: 180,
      status: 'open',
      createdAt: toISO(now),
    },
    {
      id: newId(),
      title: 'English oral — practice run',
      courseId: 'c-eng',
      lane: 'school',
      type: 'formative',
      dueAt: toISO(at(addDays(today, 5), 15, 30)),
      estMinutes: 60,
      status: 'open',
      createdAt: toISO(now),
    },
  ]

  // One already-finished task from earlier today, so the Done stack isn't empty.
  const doneTask: Task = {
    id: newId(),
    title: 'Maths exercise 7',
    courseId: 'c-math',
    lane: 'school',
    type: 'homework',
    dueAt: toISO(at(today, 15, 30)),
    estMinutes: 30,
    status: 'done',
    createdAt: toISO(addDays(now, -1)),
  }

  const doneBlock: Block = {
    id: newId(),
    taskId: doneTask.id,
    start: toISO(at(today, 14, 30)),
    end: toISO(at(today, 15, 0)),
    done: true,
  }

  // Recurring weekly template — the times the scheduler must never use.
  // Windows never cross midnight; night is two rows so per-day maths stays simple.
  const availability: Availability[] = [
    { id: newId(), label: 'Sleep', daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startTime: '00:00', endTime: '07:30' },
    { id: newId(), label: 'Wind down', daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startTime: '21:30', endTime: '23:59' },
    { id: newId(), label: 'School', daysOfWeek: [1, 2, 3, 4, 5], startTime: '08:15', endTime: '15:30' },
    { id: newId(), label: 'Riding', daysOfWeek: [2, 4], startTime: '16:30', endTime: '18:00' },
    { id: newId(), label: 'Riding', daysOfWeek: [6], startTime: '09:00', endTime: '11:00' },
  ]

  await db.transaction(
    'rw',
    db.courses,
    db.tasks,
    db.blocks,
    db.availability,
    async () => {
      await db.courses.bulkAdd(courses)
      await db.tasks.bulkAdd([...tasks, doneTask])
      await db.blocks.add(doneBlock)
      await db.availability.bulkAdd(availability)
    },
  )

  return true
}

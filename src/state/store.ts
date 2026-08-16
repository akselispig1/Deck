import { addMinutes } from 'date-fns'
import { db, getSettings, saveSettings } from '../db/db'
import type { Block, Course, Lane, Task, TaskType } from '../types'
import { schedule } from '../scheduler/scheduler'
import {
  createEvent,
  createRecurringCommitment,
  deleteEvent,
  ensureDeckCalendar,
  getPrimaryCalendarId,
  isCalendarConnected,
  updateEvent,
} from '../lib/google'
import type { Availability, Settings } from '../types'
import {
  formatShortDate,
  formatTime,
  minutesBetween,
  newId,
  toISO,
} from '../lib/time'
import type { AnthropicToolResult, StateSnapshot } from '../lib/anthropic'
import type { ConfirmationStrip } from '../types'

// All the async operations that touch IndexedDB, the scheduler, and Google
// Calendar. The React layer calls these and re-renders off Dexie live queries.

// ---- Google Calendar sync (best-effort; silent no-op when disconnected) ----

async function pushBlockToGoogle(block: Block): Promise<void> {
  if (!isCalendarConnected()) return
  try {
    const settings = await getSettings()
    const calId = await ensureDeckCalendar(settings.googleCalendarId)
    if (calId !== settings.googleCalendarId) await saveSettings({ googleCalendarId: calId })
    const task = await db.tasks.get(block.taskId)
    if (!task) return
    const course = task.courseId ? await db.courses.get(task.courseId) : undefined
    const eventId = await createEvent(calId, block, task, course)
    await db.blocks.update(block.id, { googleEventId: eventId })
  } catch (err) {
    if (import.meta.env.DEV) console.warn('pushBlockToGoogle', err)
  }
}

async function removeBlockFromGoogle(block: Block): Promise<void> {
  if (!block.googleEventId || !isCalendarConnected()) return
  try {
    const settings = await getSettings()
    if (settings.googleCalendarId) {
      await deleteEvent(settings.googleCalendarId, block.googleEventId)
    }
  } catch (err) {
    if (import.meta.env.DEV) console.warn('removeBlockFromGoogle', err)
  }
}

// ---- Scheduling ----

// Re-run the scheduler for a set of tasks (or 'all' open tasks). Clears their
// existing not-done blocks first, keeps done blocks and other tasks' blocks as
// occupied time. Returns the number of unplaced minutes, by task.
async function reschedule(
  which: string[] | 'all',
  fromDate?: Date,
): Promise<{ taskId: string; minutes: number }[]> {
  const settings = await getSettings()
  const openTasks = await db.tasks.where('status').equals('open').toArray()
  const tasks = which === 'all' ? openTasks : openTasks.filter((t) => which.includes(t.id))
  if (tasks.length === 0) return []

  const targetIds = new Set(tasks.map((t) => t.id))

  // Remove existing not-done blocks belonging to the target tasks.
  const allBlocks = await db.blocks.toArray()
  const toRemove = allBlocks.filter((b) => targetIds.has(b.taskId) && !b.done)
  for (const b of toRemove) await removeBlockFromGoogle(b)
  await db.blocks.bulkDelete(toRemove.map((b) => b.id))

  const remaining = allBlocks.filter((b) => !toRemove.some((r) => r.id === b.id))
  const availability = await db.availability.toArray()

  const result = schedule({
    tasks: tasks.map((t) => ({
      id: t.id,
      dueAt: t.dueAt,
      estMinutes: t.estMinutes,
      createdAt: t.createdAt,
    })),
    availability,
    existingBlocks: remaining.map((b) => ({ start: b.start, end: b.end })),
    settings,
    now: fromDate ?? new Date(),
  })

  const newBlocks: Block[] = result.blocks.map((pb) => ({
    id: newId(),
    taskId: pb.taskId,
    start: pb.start,
    end: pb.end,
    done: false,
  }))
  await db.blocks.bulkAdd(newBlocks)
  for (const b of newBlocks) await pushBlockToGoogle(b)

  return result.unscheduled
}

export async function scheduleTask(taskId: string): Promise<{ taskId: string; minutes: number }[]> {
  return reschedule([taskId])
}

export async function planWeek(fromDate?: Date): Promise<{ taskId: string; minutes: number }[]> {
  return reschedule('all', fromDate)
}

// ---- Task actions ----

export interface NewTaskInput {
  title: string
  courseId?: string
  lane: Lane
  type: TaskType
  dueAt: string
  estMinutes: number
  notes?: string
}

export async function createTask(input: NewTaskInput): Promise<Task> {
  const task: Task = {
    id: newId(),
    title: input.title.trim(),
    courseId: input.courseId,
    lane: input.lane,
    type: input.type,
    dueAt: input.dueAt,
    estMinutes: input.estMinutes,
    status: 'open',
    notes: input.notes,
    createdAt: toISO(new Date()),
  }
  await db.tasks.add(task)
  return task
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<void> {
  // Never let a write clobber the primary key.
  const { id: _drop, ...rest } = patch
  void _drop
  await db.tasks.update(id, rest)
  // If timing/estimate changed, the old blocks may no longer fit — re-plan it.
  if (patch.dueAt !== undefined || patch.estMinutes !== undefined) {
    const task = await db.tasks.get(id)
    if (task?.status === 'open') await scheduleTask(id)
  }
}

export async function deleteTask(id: string): Promise<void> {
  const blocks = await db.blocks.where('taskId').equals(id).toArray()
  for (const b of blocks) await removeBlockFromGoogle(b)
  await db.blocks.bulkDelete(blocks.map((b) => b.id))
  await db.tasks.delete(id)
}

export async function completeTask(id: string): Promise<void> {
  await db.tasks.update(id, { status: 'done' })
  // Mark its remaining blocks done too, so nothing dangles on Today/Week.
  const blocks = await db.blocks.where('taskId').equals(id).toArray()
  await Promise.all(
    blocks.filter((b) => !b.done).map((b) => db.blocks.update(b.id, { done: true })),
  )
}

// ---- Block actions ----

export async function completeBlock(id: string): Promise<void> {
  await db.blocks.update(id, { done: true })
  const block = await db.blocks.get(id)
  if (!block) return
  // If every block of the task is done and they cover the estimate, the whole
  // task is finished.
  const siblings = await db.blocks.where('taskId').equals(block.taskId).toArray()
  if (siblings.every((b) => b.done)) {
    const task = await db.tasks.get(block.taskId)
    if (task && task.status === 'open') {
      const scheduled = siblings.reduce((sum, b) => sum + minutesBetween(b.start, b.end), 0)
      if (scheduled >= task.estMinutes) await db.tasks.update(task.id, { status: 'done' })
    }
  }
}

export async function uncompleteBlock(id: string): Promise<void> {
  const block = await db.blocks.get(id)
  await db.blocks.update(id, { done: false })
  if (block) {
    const task = await db.tasks.get(block.taskId)
    if (task?.status === 'done') await db.tasks.update(task.id, { status: 'open' })
  }
}

export async function moveBlock(id: string, startISO: string): Promise<void> {
  const block = await db.blocks.get(id)
  if (!block) return
  const durationMin = minutesBetween(block.start, block.end)
  const start = new Date(startISO)
  const end = addMinutes(start, durationMin)
  await db.blocks.update(id, { start: toISO(start), end: toISO(end) })

  // Keep Google in sync: patch if we already pushed it, else create.
  if (isCalendarConnected()) {
    const updated = await db.blocks.get(id)
    if (updated) {
      if (updated.googleEventId) {
        try {
          const settings = await getSettings()
          const task = await db.tasks.get(updated.taskId)
          const course = task?.courseId ? await db.courses.get(task.courseId) : undefined
          const calId = await ensureDeckCalendar(settings.googleCalendarId)
          if (task) {
            await updateEvent(calId, updated.googleEventId, updated, task, course)
          }
        } catch (err) {
          if (import.meta.env.DEV) console.warn('moveBlock google', err)
        }
      } else {
        await pushBlockToGoogle(updated)
      }
    }
  }
}

export async function deleteBlock(id: string): Promise<void> {
  const block = await db.blocks.get(id)
  if (!block) return
  await removeBlockFromGoogle(block)
  await db.blocks.delete(id)
}

// "Not now" — push a block to the next free slot after it.
export async function skipBlock(id: string): Promise<void> {
  const block = await db.blocks.get(id)
  if (!block) return
  const task = await db.tasks.get(block.taskId)
  if (!task) return
  const durationMin = minutesBetween(block.start, block.end)
  const settings = await getSettings()
  const availability = await db.availability.toArray()
  const others = (await db.blocks.toArray()).filter((b) => b.id !== id)

  const result = schedule({
    tasks: [{ id: task.id, dueAt: task.dueAt, estMinutes: durationMin, createdAt: task.createdAt }],
    availability,
    existingBlocks: others.map((b) => ({ start: b.start, end: b.end })),
    settings,
    now: new Date(new Date(block.end).getTime() + 1000),
  })

  if (result.blocks[0]) {
    await moveBlock(id, result.blocks[0].start)
  }
  // If nothing fits, leave it where it is rather than dropping it.
}

// ---- Snapshot for the assistant's system prompt ----

export async function buildSnapshot(): Promise<StateSnapshot> {
  const now = new Date()
  const [courses, allTasks, blocks, availability, settings] = await Promise.all([
    db.courses.toArray(),
    db.tasks.toArray(),
    db.blocks.toArray(),
    db.availability.toArray(),
    getSettings(),
  ])
  const openTasks = allTasks.filter((t) => t.status === 'open')
  const taskById = new Map(allTasks.map((t) => [t.id, t]))
  return {
    now,
    courses,
    openTasks,
    weekBlocks: blocks.map((b) => ({
      id: b.id,
      taskId: b.taskId,
      taskTitle: taskById.get(b.taskId)?.title ?? 'Task',
      start: b.start,
      end: b.end,
      done: b.done,
    })),
    availability,
    settings: {
      blockLengthMinutes: settings.blockLengthMinutes,
      maxBlocksPerEvening: settings.maxBlocksPerEvening,
      bufferDays: settings.bufferDays,
    },
  }
}

// ---- Commitments (recurring weekly busy time: clubs, sleep, school…) ----

async function pushCommitmentToGoogle(a: Availability): Promise<void> {
  if (!isCalendarConnected()) return
  try {
    const settings = await getSettings()
    const calId = await ensureDeckCalendar(settings.googleCalendarId)
    if (calId !== settings.googleCalendarId) await saveSettings({ googleCalendarId: calId })
    const eventId = await createRecurringCommitment(
      calId,
      a.label,
      a.daysOfWeek,
      a.startTime,
      a.endTime,
    )
    await db.availability.update(a.id, { googleEventId: eventId })
  } catch (err) {
    if (import.meta.env.DEV) console.warn('pushCommitmentToGoogle', err)
  }
}

export async function addCommitment(input: {
  label: string
  daysOfWeek: number[]
  startTime: string
  endTime: string
}): Promise<Availability> {
  const a: Availability = {
    id: newId(),
    label: input.label.trim() || 'Commitment',
    daysOfWeek: input.daysOfWeek,
    startTime: input.startTime,
    endTime: input.endTime,
  }
  await db.availability.add(a)
  await pushCommitmentToGoogle(a)
  return a
}

export async function deleteCommitment(id: string): Promise<void> {
  const a = await db.availability.get(id)
  if (!a) return
  if (a.googleEventId && isCalendarConnected()) {
    try {
      const s = await getSettings()
      if (s.googleCalendarId) await deleteEvent(s.googleCalendarId, a.googleEventId)
    } catch (err) {
      if (import.meta.env.DEV) console.warn('deleteCommitment google', err)
    }
  }
  await db.availability.delete(id)
}

// Run once the user links Google: create/confirm the Deck calendar, learn the
// primary calendar id (for the embed), and push any commitments that predate
// the connection so they show in the calendar too.
export async function onCalendarConnected(): Promise<void> {
  const settings = await getSettings()
  const calId = await ensureDeckCalendar(settings.googleCalendarId)
  const primaryId = await getPrimaryCalendarId()
  await saveSettings({ googleCalendarId: calId, googlePrimaryId: primaryId })
  const commitments = await db.availability.toArray()
  for (const a of commitments) if (!a.googleEventId) await pushCommitmentToGoogle(a)
  // Also push any blocks that haven't reached Google yet.
  const blocks = await db.blocks.toArray()
  for (const b of blocks) if (!b.googleEventId && !b.done) await pushBlockToGoogle(b)
}

// ---- The chat tool executor: maps Claude's tool calls to the actions above,
// and returns a confirmation strip for every write (§9). ----

function strip(lane: Lane, text: string): ConfirmationStrip {
  return { lane, text }
}

async function laneForTask(taskId: string): Promise<Lane> {
  return (await db.tasks.get(taskId))?.lane ?? 'school'
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
): Promise<AnthropicToolResult> {
  switch (name) {
    case 'list_tasks': {
      let tasks = await db.tasks.toArray()
      if (input.status) tasks = tasks.filter((t) => t.status === input.status)
      if (input.lane) tasks = tasks.filter((t) => t.lane === input.lane)
      return {
        content: JSON.stringify(
          tasks.map((t) => ({
            id: t.id,
            title: t.title,
            lane: t.lane,
            type: t.type,
            courseId: t.courseId,
            dueAt: t.dueAt,
            estMinutes: t.estMinutes,
            status: t.status,
          })),
        ),
      }
    }

    case 'create_task': {
      const task = await createTask({
        title: String(input.title ?? 'Untitled'),
        courseId: input.courseId ? String(input.courseId) : undefined,
        lane: (input.lane as Lane) ?? 'school',
        type: (input.type as TaskType) ?? 'homework',
        dueAt: String(input.dueAt),
        estMinutes: Number(input.estMinutes ?? 40),
        notes: input.notes ? String(input.notes) : undefined,
      })
      return {
        content: JSON.stringify({ ok: true, id: task.id }),
        strip: strip(task.lane, `Added ${task.title}`),
      }
    }

    case 'update_task': {
      const id = String(input.id)
      const before = await db.tasks.get(id)
      if (!before) return { content: 'No task with that id', isError: true }
      const { id: _i, ...patch } = input as Record<string, unknown>
      void _i
      await updateTask(id, patch as Partial<Task>)
      const after = await db.tasks.get(id)
      return {
        content: JSON.stringify({ ok: true }),
        strip: strip(after?.lane ?? before.lane, `Updated ${after?.title ?? before.title}`),
      }
    }

    case 'delete_task': {
      const id = String(input.id)
      const task = await db.tasks.get(id)
      if (!task) return { content: 'No task with that id', isError: true }
      await deleteTask(id)
      return { content: JSON.stringify({ ok: true }), strip: strip(task.lane, `Deleted ${task.title}`) }
    }

    case 'complete_task': {
      const id = String(input.id)
      const task = await db.tasks.get(id)
      if (!task) return { content: 'No task with that id', isError: true }
      await completeTask(id)
      return {
        content: JSON.stringify({ ok: true }),
        strip: strip(task.lane, `Marked ${task.title} done`),
      }
    }

    case 'list_blocks': {
      const from = new Date(String(input.from)).getTime()
      const to = new Date(String(input.to)).getTime()
      const blocks = (await db.blocks.toArray()).filter((b) => {
        const s = new Date(b.start).getTime()
        return s >= from && s <= to
      })
      const tasks = new Map((await db.tasks.toArray()).map((t) => [t.id, t]))
      return {
        content: JSON.stringify(
          blocks.map((b) => ({
            id: b.id,
            taskId: b.taskId,
            task: tasks.get(b.taskId)?.title,
            start: b.start,
            end: b.end,
            done: b.done,
          })),
        ),
      }
    }

    case 'schedule_task': {
      const taskId = String(input.taskId)
      const task = await db.tasks.get(taskId)
      if (!task) return { content: 'No task with that id', isError: true }
      const unscheduled = await scheduleTask(taskId)
      const unfit = unscheduled.reduce((sum, u) => sum + u.minutes, 0)
      return {
        content: JSON.stringify({ ok: true, unscheduledMinutes: unfit }),
        strip: strip(
          task.lane,
          unfit > 0 ? `Scheduled ${task.title} (some didn't fit)` : `Scheduled ${task.title}`,
        ),
      }
    }

    case 'move_block': {
      const id = String(input.id)
      const block = await db.blocks.get(id)
      if (!block) return { content: 'No block with that id', isError: true }
      const task = await db.tasks.get(block.taskId)
      await moveBlock(id, String(input.start))
      const when = new Date(String(input.start))
      return {
        content: JSON.stringify({ ok: true }),
        strip: strip(
          await laneForTask(block.taskId),
          `Moved ${task?.title ?? 'block'} to ${formatShortDate(when)} ${formatTime(when)}`,
        ),
      }
    }

    case 'delete_block': {
      const id = String(input.id)
      const block = await db.blocks.get(id)
      if (!block) return { content: 'No block with that id', isError: true }
      const task = await db.tasks.get(block.taskId)
      await deleteBlock(id)
      return {
        content: JSON.stringify({ ok: true }),
        strip: strip(await laneForTask(block.taskId), `Removed a block for ${task?.title ?? 'task'}`),
      }
    }

    case 'reschedule_week': {
      const from = input.fromDate ? new Date(String(input.fromDate)) : undefined
      const unscheduled = await planWeek(from)
      const unfit = unscheduled.reduce((sum, u) => sum + u.minutes, 0)
      return {
        content: JSON.stringify({ ok: true, unscheduledMinutes: unfit }),
        strip: strip('school', unfit > 0 ? 'Replanned the week (some work unscheduled)' : 'Replanned the week'),
      }
    }

    case 'update_scheduling': {
      const patch: Partial<Settings> = {}
      if (input.blockLengthMinutes != null) patch.blockLengthMinutes = Number(input.blockLengthMinutes)
      if (input.maxBlocksPerEvening != null)
        patch.maxBlocksPerEvening = Number(input.maxBlocksPerEvening)
      if (input.bufferDays != null) patch.bufferDays = Number(input.bufferDays)
      await saveSettings(patch)
      await planWeek() // re-apply the new rules across everything open
      const bits: string[] = []
      if (patch.blockLengthMinutes != null) bits.push(`${patch.blockLengthMinutes}-min sessions`)
      if (patch.maxBlocksPerEvening != null) bits.push(`up to ${patch.maxBlocksPerEvening}/day`)
      if (patch.bufferDays != null) bits.push(`${patch.bufferDays}-day buffer`)
      return {
        content: JSON.stringify({ ok: true }),
        strip: strip('school', `Planning updated${bits.length ? ': ' + bits.join(', ') : ''}`),
      }
    }

    case 'add_commitment': {
      const days = Array.isArray(input.daysOfWeek)
        ? (input.daysOfWeek as unknown[]).map((d) => Number(d))
        : []
      const a = await addCommitment({
        label: String(input.label ?? 'Commitment'),
        daysOfWeek: days,
        startTime: String(input.startTime ?? '16:00'),
        endTime: String(input.endTime ?? '17:00'),
      })
      await planWeek()
      return {
        content: JSON.stringify({ ok: true, id: a.id }),
        strip: strip('charq', `Added commitment: ${a.label}`),
      }
    }

    default:
      return { content: `Unknown tool: ${name}`, isError: true }
  }
}

// Convenience used by the Add sheet's course pills etc.
export async function getCourses(): Promise<Course[]> {
  return db.courses.toArray()
}

// ---- Subjects (courses) — user-adjustable in Settings ----

export async function addCourse(input: {
  name: string
  short?: string
  colorKey: Lane
}): Promise<Course> {
  const name = input.name.trim() || 'Subject'
  const c: Course = {
    id: newId(),
    name,
    short: (input.short?.trim() || name).slice(0, 10),
    colorKey: input.colorKey,
  }
  await db.courses.add(c)
  return c
}

export async function updateCourse(id: string, patch: Partial<Course>): Promise<void> {
  const { id: _drop, ...rest } = patch
  void _drop
  await db.courses.update(id, rest)
}

export async function deleteCourse(id: string): Promise<void> {
  // Leave any tasks tagged with this course untagged rather than deleting them.
  const tagged = await db.tasks.where('courseId').equals(id).toArray()
  await Promise.all(tagged.map((t) => db.tasks.update(t.id, { courseId: undefined })))
  await db.courses.delete(id)
}

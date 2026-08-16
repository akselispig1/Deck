import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSettings, saveSettings as persistSettings } from '../db/db'
import { seedIfEmpty } from '../db/seed'
import type { Availability, Block, ChatMessage, Course, Settings, Task } from '../types'
import * as store from './store'
import { buildSystemPrompt, hasAnthropicKey, runAssistant } from '../lib/anthropic'
import {
  connectCalendar,
  disconnectCalendar,
  isCalendarConfigured,
  isCalendarConnected,
} from '../lib/google'
import { newId, toISO } from '../lib/time'

interface AppContextValue {
  ready: boolean
  now: Date

  courses: Course[]
  tasks: Task[]
  openTasks: Task[]
  blocks: Block[]
  availability: Availability[]
  settings: Settings

  // task + block actions
  createTask: typeof store.createTask
  updateTask: typeof store.updateTask
  deleteTask: typeof store.deleteTask
  completeTask: typeof store.completeTask
  completeBlock: typeof store.completeBlock
  uncompleteBlock: typeof store.uncompleteBlock
  skipBlock: typeof store.skipBlock
  moveBlock: typeof store.moveBlock
  deleteBlock: typeof store.deleteBlock
  scheduleTask: typeof store.scheduleTask
  planWeek: typeof store.planWeek

  // recurring commitments (clubs, sleep, school…)
  addCommitment: typeof store.addCommitment
  deleteCommitment: typeof store.deleteCommitment

  // subjects (courses)
  addCourse: typeof store.addCourse
  updateCourse: typeof store.updateCourse
  deleteCourse: typeof store.deleteCourse

  // settings
  updateSettings: (patch: Partial<Settings>) => Promise<void>

  // google
  calendarConfigured: boolean
  calendarConnected: boolean
  connectGoogle: () => Promise<void>
  disconnectGoogle: () => void

  // chat
  chatMessages: ChatMessage[]
  chatBusy: boolean
  chatError: string | null
  hasKey: boolean
  sendChat: (text: string) => Promise<void>
  refreshKey: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const courses = useLiveQuery(() => db.courses.toArray())
  const tasks = useLiveQuery(() => db.tasks.toArray())
  const blocks = useLiveQuery(() => db.blocks.toArray())
  const availability = useLiveQuery(() => db.availability.toArray())
  const settings = useLiveQuery(() => getSettings())
  const chatMessages = useLiveQuery(() => db.chat.orderBy('createdAt').toArray())

  const [now, setNow] = useState(() => new Date())
  const [chatBusy, setChatBusy] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [hasKey, setHasKey] = useState(hasAnthropicKey())
  const [calendarConnected, setCalendarConnected] = useState(isCalendarConnected())
  const seededRef = useRef(false)

  // First run: seed mock data, then lay out an initial week so Today isn't empty.
  useEffect(() => {
    if (seededRef.current) return
    seededRef.current = true
    ;(async () => {
      const seeded = await seedIfEmpty()
      if (seeded) await store.planWeek()
    })()
  }, [])

  // A coarse clock for the date header and the week's current-time line. The
  // Now-card countdown keeps its own per-second timer.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    await persistSettings(patch)
  }, [])

  const refreshKey = useCallback(() => setHasKey(hasAnthropicKey()), [])

  const connectGoogle = useCallback(async () => {
    await connectCalendar()
    // Create/confirm the Deck calendar, learn the primary id for the embed, and
    // push any commitments/blocks that predate the connection.
    await store.onCalendarConnected()
    setCalendarConnected(true)
  }, [])

  const disconnectGoogle = useCallback(() => {
    disconnectCalendar()
    setCalendarConnected(false)
  }, [])

  const sendChat = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setChatError(null)

    const userMsg: ChatMessage = {
      id: newId(),
      role: 'user',
      text: trimmed,
      createdAt: toISO(new Date()),
    }
    await db.chat.add(userMsg)
    setChatBusy(true)

    try {
      const snapshot = await store.buildSnapshot()
      const system = buildSystemPrompt(snapshot)
      const all = await db.chat.orderBy('createdAt').toArray()
      // Everything before this turn, trimmed to the last 30 — the assistant's
      // only memory (§9). The current user text is passed separately.
      const prior = all.slice(0, -1).slice(-30).map((m) => ({ role: m.role, text: m.text }))

      const result = await runAssistant({
        system,
        history: prior,
        userText: trimmed,
        execute: store.executeTool,
      })

      await db.chat.add({
        id: newId(),
        role: 'assistant',
        text: result.text || 'Done.',
        strips: result.strips.length ? result.strips : undefined,
        createdAt: toISO(new Date()),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      setChatError(message)
      await db.chat.add({
        id: newId(),
        role: 'assistant',
        text: message,
        createdAt: toISO(new Date()),
      })
    } finally {
      setChatBusy(false)
    }
  }, [])

  const ready =
    !!courses && !!tasks && !!blocks && !!availability && !!settings && !!chatMessages

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      now,
      courses: courses ?? [],
      tasks: tasks ?? [],
      openTasks: (tasks ?? []).filter((t) => t.status === 'open'),
      blocks: blocks ?? [],
      availability: availability ?? [],
      settings: settings ?? {
        id: 'settings',
        blockLengthMinutes: 40,
        maxBlocksPerEvening: 3,
        bufferDays: 1,
      },
      createTask: store.createTask,
      updateTask: store.updateTask,
      deleteTask: store.deleteTask,
      completeTask: store.completeTask,
      completeBlock: store.completeBlock,
      uncompleteBlock: store.uncompleteBlock,
      skipBlock: store.skipBlock,
      moveBlock: store.moveBlock,
      deleteBlock: store.deleteBlock,
      scheduleTask: store.scheduleTask,
      planWeek: store.planWeek,
      addCommitment: store.addCommitment,
      deleteCommitment: store.deleteCommitment,
      addCourse: store.addCourse,
      updateCourse: store.updateCourse,
      deleteCourse: store.deleteCourse,
      updateSettings,
      calendarConfigured: isCalendarConfigured(),
      calendarConnected,
      connectGoogle,
      disconnectGoogle,
      chatMessages: chatMessages ?? [],
      chatBusy,
      chatError,
      hasKey,
      sendChat,
      refreshKey,
    }),
    [
      ready,
      now,
      courses,
      tasks,
      blocks,
      availability,
      settings,
      chatMessages,
      chatBusy,
      chatError,
      hasKey,
      calendarConnected,
      updateSettings,
      connectGoogle,
      disconnectGoogle,
      sendChat,
      refreshKey,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}

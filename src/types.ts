// The whole data model. Everything lives in IndexedDB on the device; there is
// no server, no account, and no sync. See the build spec §4.

export type Lane = 'school' | 'charq' | 'freelance' | 'training'

export type TaskType =
  | 'homework'
  | 'summative'
  | 'formative'
  | 'revision'
  | 'admin'

export interface Course {
  id: string
  name: string // "MYP Chemistry"
  short: string // "Chem" — used in tight spaces
  teacher?: string
  colorKey: Lane
}

export interface Task {
  id: string
  title: string
  courseId?: string // undefined for non-school tasks
  lane: Lane
  type: TaskType
  dueAt: string // ISO
  estMinutes: number
  status: 'open' | 'done'
  notes?: string
  createdAt: string // ISO
}

export interface Block {
  id: string
  taskId: string
  start: string // ISO
  end: string // ISO
  done: boolean
  googleEventId?: string // set once pushed to Google Calendar
}

export interface Availability {
  // Recurring weekly commitment. Time the scheduler must NOT use — clubs, sleep,
  // school, training. Pushed to Google Calendar as a recurring event so it shows
  // in the embedded calendar too.
  id: string
  label: string // "School", "Sleep", "Chess club"
  daysOfWeek: number[] // 0-6, Sunday = 0
  startTime: string // "08:15"
  endTime: string // "15:30"
  googleEventId?: string // set once pushed to Google Calendar
}

export interface Settings {
  id: 'settings' // single row
  googleCalendarId?: string // the dedicated "Deck" calendar blocks are written to
  googlePrimaryId?: string // the user's primary calendar id (email), for the embed
  blockLengthMinutes: number // default 40 — adjusted by talking to the assistant
  maxBlocksPerEvening: number // default 3
  bufferDays: number // default 1
}

// Chat lives in IndexedDB too — it's the assistant's only memory (§9).
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  // Rendered text. For assistant turns this is the prose only; tool calls are
  // surfaced separately as confirmation strips.
  text: string
  // Confirmation strips for any write tools Claude ran on this turn.
  strips?: ConfirmationStrip[]
  createdAt: string // ISO
}

export interface ConfirmationStrip {
  lane: Lane
  text: string // "Moved German vocab to Friday 18:00"
}

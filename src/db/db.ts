import Dexie, { type Table } from 'dexie'
import type {
  Availability,
  Block,
  ChatMessage,
  Course,
  Settings,
  Task,
} from '../types'

// One IndexedDB database, on the device, forever. No server ever sees this.
export class DeckDB extends Dexie {
  courses!: Table<Course, string>
  tasks!: Table<Task, string>
  blocks!: Table<Block, string>
  availability!: Table<Availability, string>
  settings!: Table<Settings, string>
  chat!: Table<ChatMessage, string>

  constructor() {
    super('deck')
    this.version(1).stores({
      // Only the columns we query on are indexed.
      courses: 'id, colorKey',
      tasks: 'id, status, lane, dueAt, courseId',
      blocks: 'id, taskId, start, done',
      availability: 'id',
      settings: 'id',
      chat: 'id, createdAt',
    })
  }
}

export const db = new DeckDB()

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  blockLengthMinutes: 40,
  maxBlocksPerEvening: 3,
  bufferDays: 1,
}

// Read settings, filling in defaults for a fresh install.
export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('settings')
  return s ?? DEFAULT_SETTINGS
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings()
  await db.settings.put({ ...current, ...patch, id: 'settings' })
}

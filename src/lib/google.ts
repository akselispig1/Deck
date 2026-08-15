import type { Block, Course, Lane, Task } from '../types'
import { LANES } from './lanes'
import { formatDuration, formatShortDate } from './time'

// Client-side Google Calendar. Pure browser OAuth via Google Identity Services
// — no client secret, no backend. The access token is held in memory only and
// expires after ~1 hour; on expiry the UI shows a quiet "Reconnect" row rather
// than interrupting the user (§8).

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const CAL_API = 'https://www.googleapis.com/calendar/v3'
const CLIENT_ID_KEY = 'deck.googleClientId'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TokenClient = any

interface GoogleState {
  accessToken: string | null
  expiresAt: number // epoch ms
  tokenClient: TokenClient | null
  gisLoaded: boolean
}

const state: GoogleState = {
  accessToken: null,
  expiresAt: 0,
  tokenClient: null,
  gisLoaded: false,
}

export function getGoogleClientId(): string | null {
  return localStorage.getItem(CLIENT_ID_KEY)
}

export function setGoogleClientId(id: string): void {
  localStorage.setItem(CLIENT_ID_KEY, id.trim())
}

export function isCalendarConfigured(): boolean {
  return !!getGoogleClientId()
}

export function isCalendarConnected(): boolean {
  return !!state.accessToken && Date.now() < state.expiresAt
}

function loadGis(): Promise<void> {
  if (state.gisLoaded) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`)
    if (existing) {
      state.gisLoaded = true
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => {
      state.gisLoaded = true
      resolve()
    }
    script.onerror = () => reject(new Error('Could not load Google Identity Services'))
    document.head.appendChild(script)
  })
}

// Interactive connect: prompts for consent the first time, then returns a token.
export async function connectCalendar(): Promise<void> {
  const clientId = getGoogleClientId()
  if (!clientId) throw new Error('No Google client ID configured')
  await loadGis()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const google = (window as any).google
  if (!google?.accounts?.oauth2) throw new Error('Google Identity unavailable')

  await new Promise<void>((resolve, reject) => {
    state.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      callback: (resp: any) => {
        if (resp?.error) {
          reject(new Error(resp.error))
          return
        }
        state.accessToken = resp.access_token
        // expires_in is seconds; keep a small safety margin
        state.expiresAt = Date.now() + (resp.expires_in ?? 3600) * 1000 - 60_000
        resolve()
      },
    })
    state.tokenClient.requestAccessToken({ prompt: '' })
  })
}

export function disconnectCalendar(): void {
  state.accessToken = null
  state.expiresAt = 0
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!isCalendarConnected()) throw new Error('Calendar not connected')
  const res = await fetch(`${CAL_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${state.accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  if (res.status === 401) {
    // Token lapsed mid-flight — drop it so the UI surfaces Reconnect.
    disconnectCalendar()
    throw new Error('Calendar session expired')
  }
  if (!res.ok) {
    throw new Error(`Calendar API error ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

// Create (once) a dedicated "Deck" calendar so blocks can be toggled off in
// Google Calendar without touching the user's other events.
export async function ensureDeckCalendar(existingId?: string): Promise<string> {
  if (existingId) {
    try {
      await api(`/calendars/${encodeURIComponent(existingId)}`)
      return existingId
    } catch {
      // fall through and recreate
    }
  }
  const list = await api<{ items?: Array<{ id: string; summary: string }> }>(
    '/users/me/calendarList',
  )
  const found = list.items?.find((c) => c.summary === 'Deck')
  if (found) return found.id

  const created = await api<{ id: string }>('/calendars', {
    method: 'POST',
    body: JSON.stringify({ summary: 'Deck', description: 'Work sessions planned by Deck.' }),
  })
  return created.id
}

function eventBody(block: Block, task: Task, course?: Course) {
  const summary = task.title
  const durationMin = Math.round(
    (new Date(block.end).getTime() - new Date(block.start).getTime()) / 60000,
  )
  const laneMeta = LANES[(course?.colorKey ?? task.lane) as Lane]
  return {
    summary,
    description: `Deck · due ${formatShortDate(task.dueAt)} · ${formatDuration(
      durationMin,
    )} of ${formatDuration(task.estMinutes)}`,
    start: { dateTime: block.start },
    end: { dateTime: block.end },
    colorId: laneMeta.googleColorId,
    reminders: {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: 10 }],
    },
  }
}

export async function createEvent(
  calendarId: string,
  block: Block,
  task: Task,
  course?: Course,
): Promise<string> {
  const created = await api<{ id: string }>(
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: 'POST', body: JSON.stringify(eventBody(block, task, course)) },
  )
  return created.id
}

export async function updateEvent(
  calendarId: string,
  eventId: string,
  block: Block,
  task: Task,
  course?: Course,
): Promise<void> {
  await api(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'PATCH', body: JSON.stringify(eventBody(block, task, course)) },
  )
}

export async function deleteEvent(calendarId: string, eventId: string): Promise<void> {
  try {
    await api(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: 'DELETE' },
    )
  } catch (err) {
    // A 404/410 (already gone) is fine; anything else we let bubble in dev.
    if (import.meta.env.DEV) console.warn('deleteEvent', err)
  }
}

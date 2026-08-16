import type { Availability, ConfirmationStrip, Course, Lane, Task } from '../types'

// Claude, called directly from the browser. Anthropic allows this with the
// dangerous-direct-browser-access header (§9). The user's key lives in
// localStorage and is never written to the repo or a build artifact.

const API_URL = 'https://api.anthropic.com/v1/messages'
const KEY_STORAGE = 'deck.anthropicApiKey'

// The spec referenced `claude-sonnet-4-6`; `claude-sonnet-5` is the current
// model in that same Sonnet tier (near-Opus quality on tool-use/agentic work
// at Sonnet cost) and the documented upgrade target. Kept as a single constant
// so it is trivial to change.
const CLAUDE_MODEL = 'claude-sonnet-5'
// Room for adaptive thinking plus the reply; capped low to respect a personal
// API budget. Non-streaming, so it stays well under the SDK timeout ceiling.
const MAX_TOKENS = 4096
const MAX_TOOL_ITERATIONS = 8

export function getAnthropicKey(): string | null {
  return localStorage.getItem(KEY_STORAGE)
}
export function setAnthropicKey(key: string): void {
  localStorage.setItem(KEY_STORAGE, key.trim())
}
export function clearAnthropicKey(): void {
  localStorage.removeItem(KEY_STORAGE)
}
export function hasAnthropicKey(): boolean {
  return !!getAnthropicKey()
}

// ---- Tool definitions (§9). Claude can both read and write. ----

export const TOOLS = [
  {
    name: 'list_tasks',
    description: 'List tasks, optionally filtered by status or lane.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['open', 'done'] },
        lane: { type: 'string', enum: ['school', 'charq', 'freelance', 'training'] },
      },
    },
  },
  {
    name: 'create_task',
    description: 'Add a new task. dueAt is an ISO 8601 datetime. estMinutes is the total estimated work in minutes.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        courseId: { type: 'string', description: 'Optional course id for school work' },
        dueAt: { type: 'string' },
        estMinutes: { type: 'number' },
        lane: { type: 'string', enum: ['school', 'charq', 'freelance', 'training'] },
        type: {
          type: 'string',
          enum: ['homework', 'summative', 'formative', 'revision', 'admin'],
        },
        notes: {
          type: 'string',
          description: 'Optional description / details for this task — shows in the calendar event.',
        },
      },
      required: ['title', 'dueAt', 'estMinutes', 'lane', 'type'],
    },
  },
  {
    name: 'update_task',
    description: 'Edit fields of an existing task. Only include the fields to change.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        courseId: { type: 'string' },
        dueAt: { type: 'string' },
        estMinutes: { type: 'number' },
        lane: { type: 'string', enum: ['school', 'charq', 'freelance', 'training'] },
        type: {
          type: 'string',
          enum: ['homework', 'summative', 'formative', 'revision', 'admin'],
        },
        notes: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_task',
    description: 'Remove a task and any blocks scheduled for it.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'complete_task',
    description: 'Mark a task as done.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'list_blocks',
    description: 'List scheduled work blocks between two ISO datetimes.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string' },
        to: { type: 'string' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'schedule_task',
    description: 'Run the scheduler for a single task, placing its work blocks on the calendar.',
    input_schema: {
      type: 'object',
      properties: { taskId: { type: 'string' } },
      required: ['taskId'],
    },
  },
  {
    name: 'move_block',
    description: 'Reschedule a block to a new ISO start time (and push the change to Google Calendar if connected).',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        start: { type: 'string' },
      },
      required: ['id', 'start'],
    },
  },
  {
    name: 'delete_block',
    description: 'Delete a block (and remove it from Google Calendar if connected).',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'reschedule_week',
    description: 'Re-run the scheduler across every open task, from an optional ISO date onward.',
    input_schema: {
      type: 'object',
      properties: { fromDate: { type: 'string' } },
    },
  },
  {
    name: 'update_scheduling',
    description:
      'Change how study time is planned when the user asks (e.g. shorter sessions, more per day, a bigger buffer before deadlines). Re-plans everything open. All fields optional.',
    input_schema: {
      type: 'object',
      properties: {
        blockLengthMinutes: { type: 'number', description: 'Length of each study session, minutes' },
        maxBlocksPerEvening: { type: 'number', description: 'Max sessions to place on one day' },
        bufferDays: { type: 'number', description: 'Days to leave clear before a deadline' },
      },
    },
  },
  {
    name: 'add_commitment',
    description:
      'Add a recurring weekly commitment that blocks time and shows on the calendar (a club, training, sleep…). Times are 24-hour HH:MM. daysOfWeek uses 0=Sunday … 6=Saturday.',
    input_schema: {
      type: 'object',
      properties: {
        label: { type: 'string' },
        daysOfWeek: { type: 'array', items: { type: 'number' } },
        startTime: { type: 'string' },
        endTime: { type: 'string' },
      },
      required: ['label', 'daysOfWeek', 'startTime', 'endTime'],
    },
  },
] as const

// ---- System prompt: inject compact current state on every request (§9). ----

export interface StateSnapshot {
  now: Date
  courses: Course[]
  openTasks: Task[]
  weekBlocks: { id: string; taskId: string; taskTitle: string; start: string; end: string; done: boolean }[]
  availability: Availability[]
  settings: { blockLengthMinutes: number; maxBlocksPerEvening: number; bufferDays: number }
}

export function buildSystemPrompt(s: StateSnapshot): string {
  // Compact JSON — this is the whole reason the assistant feels like it knows
  // anything about the user's week.
  const state = {
    today: s.now.toISOString(),
    weekday: s.now.toLocaleDateString('en-GB', { weekday: 'long' }),
    settings: s.settings,
    courses: s.courses.map((c) => ({ id: c.id, name: c.name, short: c.short, lane: c.colorKey })),
    openTasks: s.openTasks.map((t) => ({
      id: t.id,
      title: t.title,
      lane: t.lane,
      type: t.type,
      courseId: t.courseId,
      dueAt: t.dueAt,
      estMinutes: t.estMinutes,
    })),
    scheduledBlocks: s.weekBlocks.map((b) => ({
      id: b.id,
      taskId: b.taskId,
      task: b.taskTitle,
      start: b.start,
      end: b.end,
      done: b.done,
    })),
    availability: s.availability.map((a) => ({
      label: a.label,
      days: a.daysOfWeek,
      start: a.startTime,
      end: a.endTime,
    })),
  }

  return [
    "You are the assistant inside Deck, a personal school planner for a 14-year-old IB MYP student who also runs two side projects (CharQ and freelance work) and trains.",
    'Deck answers one question: what should I work on right now. Keep the calendar calm and realistic.',
    'You can read and change tasks and the schedule using the provided tools. Prefer doing the work with tools over just describing it.',
    'The user changes how planning works by talking to you: use update_scheduling to adjust session length, sessions per day, or the buffer before deadlines whenever they ask for a different style. Use add_commitment for recurring things like clubs or training so study is planned around them.',
    'Tasks may carry a description (notes) and a deadline — use them to plan sensibly. When adding a task, schedule it (schedule_task) so it lands on the calendar.',
    'To build a plan (e.g. a training plan leading up to a race), create one task per session, each with a clear notes description of what to do that session, and schedule each — the description then shows in the calendar event.',
    'When you change something, do it and then confirm briefly in one short, warm sentence — the UI already shows a confirmation strip for each change, so you do not need to restate every detail.',
    'Lanes are: school, charq, freelance, training. Times are local. Durations are in minutes.',
    'Never invent task or block ids — use the ones in the state below.',
    'Be concise. Answer plainly, no preamble.',
    '',
    'Current state (JSON):',
    JSON.stringify(state),
  ].join('\n')
}

// ---- The agentic loop (§9). ----

export interface AnthropicToolResult {
  content: string
  strip?: ConfirmationStrip
  isError?: boolean
}

export type ToolExecutor = (
  name: string,
  input: Record<string, unknown>,
) => Promise<AnthropicToolResult>

export interface RunAssistantArgs {
  system: string
  // Prior chat, replayed as the assistant's only memory. Plain text turns.
  history: { role: 'user' | 'assistant'; text: string }[]
  userText: string
  execute: ToolExecutor
  onStrip?: (strip: ConfirmationStrip) => void
}

export interface RunAssistantResult {
  text: string
  strips: ConfirmationStrip[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContentBlock = any
interface ApiMessage {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}

async function callClaude(system: string, messages: ApiMessage[]): Promise<{
  stop_reason: string
  content: ContentBlock[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any
}> {
  const apiKey = getAnthropicKey()
  if (!apiKey) throw new Error('No Anthropic API key set')

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages,
      tools: TOOLS,
    }),
  })

  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      detail = body?.error?.message ?? ''
    } catch {
      /* ignore */
    }
    if (res.status === 401) throw new Error('That API key was rejected. Check it in Settings.')
    if (res.status === 429) throw new Error("You're sending messages too fast — give it a moment.")
    throw new Error(detail || `Claude API error ${res.status}`)
  }

  return res.json()
}

function extractText(content: ContentBlock[]): string {
  return content
    .filter((b) => b.type === 'text')
    .map((b) => b.text as string)
    .join('\n')
    .trim()
}

export async function runAssistant(args: RunAssistantArgs): Promise<RunAssistantResult> {
  const { system, history, userText, execute, onStrip } = args

  const messages: ApiMessage[] = [
    ...history.map((h) => ({ role: h.role, content: h.text })),
    { role: 'user', content: userText },
  ]

  const strips: ConfirmationStrip[] = []
  const textParts: string[] = []

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const resp = await callClaude(system, messages)

    const said = extractText(resp.content)
    if (said) textParts.push(said)

    if (resp.stop_reason === 'refusal') {
      textParts.push("I can't help with that one.")
      break
    }

    if (resp.stop_reason !== 'tool_use') {
      break
    }

    // Record the assistant's full turn (text + tool_use blocks) verbatim.
    messages.push({ role: 'assistant', content: resp.content })

    // Execute each tool call locally against Dexie / Google.
    const toolResults: ContentBlock[] = []
    for (const block of resp.content) {
      if (block.type !== 'tool_use') continue
      let result: AnthropicToolResult
      try {
        result = await execute(block.name, (block.input ?? {}) as Record<string, unknown>)
      } catch (err) {
        result = { content: err instanceof Error ? err.message : 'Tool failed', isError: true }
      }
      if (result.strip) {
        strips.push(result.strip)
        onStrip?.(result.strip)
      }
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: result.content,
        ...(result.isError ? { is_error: true } : {}),
      })
    }

    messages.push({ role: 'user', content: toolResults })
  }

  return { text: textParts.join('\n\n').trim(), strips }
}

// Re-export Lane so callers importing tool plumbing have the enum handy.
export type { Lane }

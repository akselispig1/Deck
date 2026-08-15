import { useState } from 'react'
import { addDays, format, nextFriday } from 'date-fns'
import { useApp } from '../state/AppContext'
import { Sheet } from './Sheet'
import type { Lane } from '../types'
import { LANE_ORDER, LANES, laneVar } from '../lib/lanes'
import { toISO } from '../lib/time'

const ESTIMATES: { label: string; minutes: number }[] = [
  { label: '20m', minutes: 20 },
  { label: '40m', minutes: 40 },
  { label: '1h', minutes: 60 },
  { label: '2h', minutes: 120 },
  { label: '4h', minutes: 240 },
  { label: '8h', minutes: 480 },
]

function Pill({
  active,
  onClick,
  children,
  color,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  color?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-label transition-colors ${
        active ? 'text-white' : 'border border-hairline text-graphite'
      }`}
      style={active ? { backgroundColor: color ?? laneVar('school') } : undefined}
    >
      {children}
    </button>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-hairline px-6 py-4 first:border-t-0">
      <p className="mb-2 text-micro uppercase text-graphite">{label}</p>
      {children}
    </div>
  )
}

export function AddTaskSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp()
  const [title, setTitle] = useState('')
  const [courseId, setCourseId] = useState<string | undefined>(undefined)
  const [lane, setLane] = useState<Lane>('school')
  const [dueDate, setDueDate] = useState(() => format(addDays(new Date(), 1), 'yyyy-MM-dd'))
  const [est, setEst] = useState(40)

  function reset() {
    setTitle('')
    setCourseId(undefined)
    setLane('school')
    setDueDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'))
    setEst(40)
  }

  async function add() {
    if (!title.trim()) return
    const course = courseId ? app.courses.find((c) => c.id === courseId) : undefined
    const due = new Date(`${dueDate}T23:59:00`)
    const task = await app.createTask({
      title,
      courseId,
      lane: course?.colorKey ?? lane,
      type: 'homework',
      dueAt: toISO(due),
      estMinutes: est,
    })
    // Land it on the calendar straight away so the add feels complete.
    await app.scheduleTask(task.id)
    reset()
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} label="Add task">
      <div className="pb-6">
        {/* Title — no visible box, just placeholder */}
        <div className="px-6 pb-4 pt-4">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            className="w-full border-0 bg-transparent p-0 text-[20px] text-ink placeholder:text-graphite focus:outline-none focus:ring-0"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void add()
            }}
          />
        </div>

        {app.courses.length > 0 && (
          <Row label="Course">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <Pill active={!courseId} onClick={() => setCourseId(undefined)}>
                None
              </Pill>
              {app.courses.map((c) => (
                <Pill
                  key={c.id}
                  active={courseId === c.id}
                  color={laneVar(c.colorKey)}
                  onClick={() => setCourseId(c.id)}
                >
                  {c.short}
                </Pill>
              ))}
            </div>
          </Row>
        )}

        <Row label="Due">
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            <Pill
              active={dueDate === format(addDays(new Date(), 1), 'yyyy-MM-dd')}
              onClick={() => setDueDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'))}
            >
              Tomorrow
            </Pill>
            <Pill
              active={dueDate === format(nextFriday(new Date()), 'yyyy-MM-dd')}
              onClick={() => setDueDate(format(nextFriday(new Date()), 'yyyy-MM-dd'))}
            >
              Friday
            </Pill>
            <Pill
              active={dueDate === format(addDays(new Date(), 7), 'yyyy-MM-dd')}
              onClick={() => setDueDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'))}
            >
              Next week
            </Pill>
          </div>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-control border border-hairline bg-paper px-3 py-2 text-label text-ink focus:outline-none"
          />
        </Row>

        <Row label="How long">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {ESTIMATES.map((e) => (
              <Pill key={e.minutes} active={est === e.minutes} onClick={() => setEst(e.minutes)}>
                {e.label}
              </Pill>
            ))}
          </div>
        </Row>

        {!courseId && (
          <Row label="Lane">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {LANE_ORDER.map((l) => (
                <Pill
                  key={l}
                  active={lane === l}
                  color={laneVar(l)}
                  onClick={() => setLane(l)}
                >
                  {LANES[l].label}
                </Pill>
              ))}
            </div>
          </Row>
        )}

        <div className="px-6 pt-4">
          <button
            onClick={add}
            disabled={!title.trim()}
            className="w-full rounded-control py-3 text-label font-medium text-white disabled:opacity-40"
            style={{ backgroundColor: laneVar('school') }}
          >
            Add
          </button>
        </div>
      </div>
    </Sheet>
  )
}

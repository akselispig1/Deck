import { useMemo, useRef, useState } from 'react'
import { addDays, isSameDay, startOfDay, startOfWeek } from 'date-fns'
import { useApp } from '../state/AppContext'
import type { Availability, Block } from '../types'
import { laneVar, laneVarAlpha } from '../lib/lanes'
import { timeStringToMinutes, toISO } from '../lib/time'
import { BlockSheet } from '../components/BlockSheet'

const DAY_START = 6 * 60 // 06:00
const DAY_END = 24 * 60 // 24:00
const PX = 0.8 // pixels per minute
const GUTTER = 26 // left hour-label gutter
const SNAP = 15

const yFor = (min: number) => (min - DAY_START) * PX
const HEIGHT = (DAY_END - DAY_START) * PX

interface DragState {
  blockId: string
  originDay: Date
  originStartMin: number
  durationMin: number
  startX: number
  startY: number
  dx: number
  dy: number
  moved: boolean
}

export function Week() {
  const app = useApp()
  const { now, blocks, tasks, availability } = app
  const gridRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const weekStart = useMemo(() => startOfWeek(now, { weekStartsOn: 1 }), [now])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const nowMin = now.getHours() * 60 + now.getMinutes()

  const colWidth = () => {
    const el = gridRef.current
    if (!el) return 0
    return (el.clientWidth - GUTTER) / 7
  }

  function minutesOf(iso: string): number {
    const d = new Date(iso)
    return d.getHours() * 60 + d.getMinutes()
  }

  // ---- Drag to reschedule ----
  function onPointerDown(e: React.PointerEvent, block: Block) {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setDrag({
      blockId: block.id,
      originDay: startOfDay(new Date(block.start)),
      originStartMin: minutesOf(block.start),
      durationMin: Math.round((new Date(block.end).getTime() - new Date(block.start).getTime()) / 60000),
      startX: e.clientX,
      startY: e.clientY,
      dx: 0,
      dy: 0,
      moved: false,
    })
  }

  function onPointerMove(e: React.PointerEvent) {
    setDrag((d) => {
      if (!d) return d
      const dx = e.clientX - d.startX
      const dy = e.clientY - d.startY
      const moved = d.moved || Math.abs(dx) > 5 || Math.abs(dy) > 5
      return { ...d, dx, dy, moved }
    })
  }

  function onPointerUp(block: Block) {
    const d = drag
    setDrag(null)
    if (!d) return
    if (!d.moved) {
      setSelected(block.id) // a tap, not a drag
      return
    }
    const cw = colWidth() || 1
    const deltaDays = Math.round(d.dx / cw)
    const deltaMin = Math.round(d.dy / PX / SNAP) * SNAP
    const newMin = Math.max(0, Math.round((d.originStartMin + deltaMin) / SNAP) * SNAP)
    const newDay = addDays(d.originDay, deltaDays)
    const newStart = new Date(newDay)
    newStart.setHours(0, newMin, 0, 0)
    void app.moveBlock(block.id, toISO(newStart))
  }

  const hourMarks = useMemo(() => {
    const out: number[] = []
    for (let h = Math.ceil(DAY_START / 60); h <= DAY_END / 60; h += 3) out.push(h)
    return out
  }, [])

  return (
    <div className="px-2 pb-28 pt-8 md:pt-10">
      {/* Day headers */}
      <div className="mb-2 flex" style={{ paddingLeft: GUTTER }}>
        {days.map((day) => {
          const today = isSameDay(day, now)
          return (
            <div key={day.toISOString()} className="flex-1 text-center">
              <div className="text-micro uppercase text-graphite">
                {day.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2)}
              </div>
              <div
                className={`text-label tabular-nums ${today ? 'text-ink' : 'text-graphite'}`}
                style={today ? { color: laneVar('school') } : undefined}
              >
                {day.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      <div ref={gridRef} className="relative" style={{ height: HEIGHT }}>
        {/* Hour gridlines + labels */}
        {hourMarks.map((h) => (
          <div key={h} className="absolute inset-x-0" style={{ top: yFor(h * 60) }}>
            <div className="absolute left-0 -translate-y-1/2 text-micro tabular-nums text-graphite">
              {String(h).padStart(2, '0')}
            </div>
            <div className="border-t border-hairline/60" style={{ marginLeft: GUTTER }} />
          </div>
        ))}

        {/* Columns */}
        <div className="absolute inset-y-0 right-0 flex" style={{ left: GUTTER }}>
          {days.map((day) => {
            const today = isSameDay(day, now)
            const dayBlocks = blocks.filter((b) => isSameDay(new Date(b.start), day))
            return (
              <div
                key={day.toISOString()}
                className="relative flex-1 border-l border-hairline/60"
                style={today ? { backgroundColor: 'rgb(var(--todaycol))' } : undefined}
              >
                {/* Availability = unavailable ground */}
                {availabilityRects(availability, day).map((r, i) => (
                  <div
                    key={i}
                    className="absolute inset-x-0 bg-hairline/70"
                    style={{ top: yFor(r.start), height: (r.end - r.start) * PX }}
                    aria-hidden
                  />
                ))}

                {/* Blocks */}
                {dayBlocks.map((b) => {
                  const startMin = minutesOf(b.start)
                  const durMin = Math.round(
                    (new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000,
                  )
                  const lane = taskById.get(b.taskId)?.lane ?? 'school'
                  const isDragging = drag?.blockId === b.id && drag.moved
                  return (
                    <button
                      key={b.id}
                      onPointerDown={(e) => onPointerDown(e, b)}
                      onPointerMove={onPointerMove}
                      onPointerUp={() => onPointerUp(b)}
                      className="absolute left-0.5 right-0.5 overflow-hidden rounded-[7px] px-1 pt-0.5 text-left touch-none"
                      style={{
                        top: yFor(startMin),
                        height: Math.max(14, durMin * PX),
                        backgroundColor: laneVarAlpha(lane, b.done ? 0.06 : 0.12),
                        borderLeft: `2px solid ${laneVar(lane)}`,
                        transform: isDragging
                          ? `translate(${drag.dx}px, ${drag.dy}px) scale(1.03)`
                          : undefined,
                        boxShadow: isDragging
                          ? '0 4px 12px rgba(29,27,24,0.18)'
                          : undefined,
                        zIndex: isDragging ? 40 : undefined,
                        opacity: b.done ? 0.6 : 1,
                      }}
                    >
                      <span
                        className={`block truncate text-micro leading-tight ${b.done ? 'line-through' : ''}`}
                        style={{ color: laneVar(lane) }}
                      >
                        {taskById.get(b.taskId)?.title ?? 'Task'}
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Current-time line across all columns */}
        {days.some((d) => isSameDay(d, now)) && nowMin >= DAY_START && nowMin <= DAY_END && (
          <div
            className="pointer-events-none absolute inset-x-0 z-30"
            style={{ top: yFor(nowMin) }}
            aria-hidden
          >
            <div className="h-px" style={{ backgroundColor: laneVar('school'), marginLeft: GUTTER }} />
          </div>
        )}
      </div>

      <BlockSheet
        blockId={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}

interface Rect {
  start: number
  end: number
}

function availabilityRects(availability: Availability[], day: Date): Rect[] {
  const dow = day.getDay()
  const rects: Rect[] = []
  for (const a of availability) {
    if (!a.daysOfWeek.includes(dow)) continue
    const start = Math.max(DAY_START, timeStringToMinutes(a.startTime))
    const end = Math.min(DAY_END, timeStringToMinutes(a.endTime))
    if (end > start) rects.push({ start, end })
  }
  return rects
}

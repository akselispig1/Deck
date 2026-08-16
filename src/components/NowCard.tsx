import { useEffect, useRef, useState } from 'react'
import type { Block, Task } from '../types'
import { formatCountdown, formatDuration, formatTimeRange, minutesBetween } from '../lib/time'

interface NowCardProps {
  block: Block | null
  task: Task | undefined
  onStart: () => void
  onComplete: () => void
  onSkip: () => void
  onPlanWeek: () => void
}

const PRIMARY = 'rgb(var(--primary))'

// "What should I work on right now." A 3px accent bar runs down the left edge;
// once started it slowly drains to zero over the block's duration.
export function NowCard({ block, task, onStart, onComplete, onSkip, onPlanWeek }: NowCardProps) {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [, setTick] = useState(0)
  const firedRef = useRef(false)

  useEffect(() => {
    setStartedAt(null)
    firedRef.current = false
  }, [block?.id])

  useEffect(() => {
    if (startedAt === null) return
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [startedAt])

  if (!block) {
    return (
      <div className="relative overflow-hidden rounded-card bg-card p-6 shadow-card">
        <p className="mb-5 text-display text-ink">Nothing scheduled</p>
        <button
          onClick={onPlanWeek}
          className="rounded-control bg-primary px-5 py-2.5 text-label font-medium text-white"
        >
          Plan my week
        </button>
      </div>
    )
  }

  const durationMin = minutesBetween(block.start, block.end)
  const durationMs = durationMin * 60_000
  const running = startedAt !== null
  const elapsedMs = running ? Date.now() - (startedAt as number) : 0
  const remainingMs = durationMs - elapsedMs

  if (running && remainingMs <= 0 && !firedRef.current) {
    firedRef.current = true
    queueMicrotask(onComplete)
  }

  const barStyle = running
    ? {
        backgroundColor: PRIMARY,
        transformOrigin: 'top' as const,
        animation: `deck-drain ${durationMs / 1000}s linear ${-elapsedMs / 1000}s forwards`,
      }
    : { backgroundColor: PRIMARY }

  return (
    <div className="relative overflow-hidden rounded-card bg-card shadow-card">
      <span data-drain aria-hidden className="absolute left-0 top-0 h-full w-1" style={barStyle} />
      <div className="p-6 pl-7">
        <p className="text-micro uppercase text-primary">
          {running
            ? `${formatCountdown(remainingMs)} remaining`
            : `Next up · ${formatDuration(durationMin)}`}
        </p>

        <h2 className="mt-3 text-display text-ink">{task?.title ?? 'Task'}</h2>

        <p className="mt-2 text-label text-graphite tabular-nums">
          {formatTimeRange(block.start, block.end)}
        </p>

        <div className="mt-5 flex items-center gap-2">
          {running ? (
            <button
              onClick={onComplete}
              className="rounded-control bg-primary px-6 py-2.5 text-label font-medium text-white"
            >
              Done
            </button>
          ) : (
            <button
              onClick={() => {
                setStartedAt(Date.now())
                onStart()
              }}
              className="rounded-control bg-primary px-6 py-2.5 text-label font-medium text-white"
            >
              Start
            </button>
          )}
          <button onClick={onSkip} className="px-4 py-2.5 text-label font-medium text-primary">
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import type { Block, Task } from '../types'
import { laneVar } from '../lib/lanes'
import { formatCountdown, formatDuration, formatTimeRange, minutesBetween } from '../lib/time'

interface NowCardProps {
  block: Block | null
  task: Task | undefined
  onStart: () => void
  onComplete: () => void
  onSkip: () => void
  onPlanWeek: () => void
}

// The only thing in the app rendered at display scale. A 3px clay bar runs down
// the left edge; once started, that bar slowly drains to zero over the block's
// duration — the single piece of ambient motion in Deck.
export function NowCard({ block, task, onStart, onComplete, onSkip, onPlanWeek }: NowCardProps) {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [, setTick] = useState(0)
  const firedRef = useRef(false)

  // Reset the running state whenever the next-up block changes.
  useEffect(() => {
    setStartedAt(null)
    firedRef.current = false
  }, [block?.id])

  // Per-second tick while a session is running, for the live countdown.
  useEffect(() => {
    if (startedAt === null) return
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [startedAt])

  if (!block) {
    return (
      <div className="relative overflow-hidden rounded-card bg-card p-6 shadow-card">
        <p className="mb-5 font-serif text-display text-ink">Nothing scheduled</p>
        <button
          onClick={onPlanWeek}
          className="rounded-control px-5 py-3 text-label font-medium text-white"
          style={{ backgroundColor: laneVar('school') }}
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

  // Fire completion once the countdown reaches zero.
  if (running && remainingMs <= 0 && !firedRef.current) {
    firedRef.current = true
    // Defer out of render.
    queueMicrotask(onComplete)
  }

  const barStyle = running
    ? {
        backgroundColor: laneVar('school'),
        transformOrigin: 'top' as const,
        animation: `deck-drain ${durationMs / 1000}s linear ${-elapsedMs / 1000}s forwards`,
      }
    : { backgroundColor: laneVar('school') }

  return (
    <div className="relative overflow-hidden rounded-card bg-card shadow-card">
      <span
        data-drain
        aria-hidden
        className="absolute left-0 top-0 h-full w-[3px]"
        style={barStyle}
      />
      <div className="p-6">
        <p className="text-micro uppercase" style={{ color: laneVar('school') }}>
          {running
            ? `${formatCountdown(remainingMs)} remaining`
            : `Next up · ${formatDuration(durationMin)}`}
        </p>

        <h2 className="mt-3 font-serif text-display text-ink">{task?.title ?? 'Task'}</h2>

        <p className="mt-3 text-label text-graphite tabular-nums">
          {formatTimeRange(block.start, block.end)}
        </p>

        <div className="mt-5 flex items-center gap-2">
          {running ? (
            <button
              onClick={onComplete}
              className="rounded-control px-5 py-3 text-label font-medium text-white"
              style={{ backgroundColor: laneVar('school') }}
            >
              Done
            </button>
          ) : (
            <button
              onClick={() => {
                setStartedAt(Date.now())
                onStart()
              }}
              className="rounded-control px-5 py-3 text-label font-medium text-white"
              style={{ backgroundColor: laneVar('school') }}
            >
              Start
            </button>
          )}
          <button onClick={onSkip} className="px-4 py-3 text-label font-medium text-graphite">
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}

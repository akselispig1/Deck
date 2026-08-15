import { useMemo, useState } from 'react'
import { isSameDay } from 'date-fns'
import { useApp } from '../state/AppContext'
import { NowCard } from '../components/NowCard'
import { BlockRow } from '../components/BlockRow'
import type { Block, Task } from '../types'
import { laneVar } from '../lib/lanes'
import {
  formatDayName,
  formatDayNumber,
  formatDuration,
  formatMonth,
  minutesBetween,
} from '../lib/time'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function Eyebrow({ children }: { children: string }) {
  return <h3 className="mb-2 mt-8 text-micro uppercase text-graphite">{children}</h3>
}

export function Today({ onOpenChat }: { onOpenChat: () => void }) {
  const app = useApp()
  const { now, blocks, tasks } = app

  const [completingId, setCompletingId] = useState<string | null>(null)
  const [justDoneId, setJustDoneId] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const laneOf = (b: Block) => taskById.get(b.taskId)?.lane ?? 'school'

  const notDone = useMemo(
    () =>
      [...blocks]
        .filter((b) => !b.done)
        .sort((a, b) => a.start.localeCompare(b.start)),
    [blocks],
  )
  const nextBlock = notDone[0] ?? null

  const laterToday = useMemo(
    () =>
      notDone.filter(
        (b) => b.id !== nextBlock?.id && isSameDay(new Date(b.start), now),
      ),
    [notDone, nextBlock, now],
  )

  const doneToday = useMemo(
    () =>
      [...blocks]
        .filter((b) => b.done && isSameDay(new Date(b.start), now))
        .sort((a, b) => a.start.localeCompare(b.start)),
    [blocks, now],
  )

  // Open tasks whose scheduled blocks don't cover their estimate. Shown plainly,
  // no warning styling (§5.6).
  const unscheduled = useMemo(() => {
    const scheduledByTask = new Map<string, number>()
    for (const b of blocks) {
      scheduledByTask.set(
        b.taskId,
        (scheduledByTask.get(b.taskId) ?? 0) + minutesBetween(b.start, b.end),
      )
    }
    return tasks
      .filter((t) => t.status === 'open')
      .map((t) => ({ task: t, remaining: t.estMinutes - (scheduledByTask.get(t.id) ?? 0) }))
      .filter((x) => x.remaining >= 15)
      .sort((a, b) => a.task.dueAt.localeCompare(b.task.dueAt))
  }, [blocks, tasks])

  function flagDone(id: string) {
    setJustDoneId(id)
    setTimeout(() => setJustDoneId((cur) => (cur === id ? null : cur)), 340)
  }

  function completeNow() {
    if (!nextBlock) return
    const id = nextBlock.id
    void app.completeBlock(id)
    flagDone(id)
  }

  function completeLater(id: string) {
    if (prefersReducedMotion()) {
      void app.completeBlock(id)
      flagDone(id)
      return
    }
    // Collapse the row, then commit to the DB so it re-appears in Done.
    setCompletingId(id)
    setTimeout(() => {
      setCompletingId(null)
      void app.completeBlock(id)
      flagDone(id)
    }, 320)
  }

  const doneCollapsed = doneToday.length > 3 && !showDone

  return (
    <div className="px-6 pb-28 pt-8 md:pt-12">
      {/* Date header */}
      <header className="mb-6">
        <p className="text-micro uppercase text-graphite">{formatDayName(now)}</p>
        <p className="font-serif text-date leading-none text-ink tabular-nums">
          {formatDayNumber(now)}
        </p>
        <p className="text-label text-graphite">{formatMonth(now)}</p>
      </header>

      <NowCard
        block={nextBlock}
        task={nextBlock ? taskById.get(nextBlock.taskId) : undefined}
        onStart={() => {}}
        onComplete={completeNow}
        onSkip={() => nextBlock && app.skipBlock(nextBlock.id)}
        onPlanWeek={() => app.planWeek()}
      />

      {laterToday.length > 0 && (
        <section>
          <Eyebrow>Later today</Eyebrow>
          <div className="border-t border-hairline">
            {laterToday.map((b) => (
              <BlockRow
                key={b.id}
                block={b}
                task={taskById.get(b.taskId)}
                lane={laneOf(b)}
                completing={completingId === b.id}
                onClick={() => completeLater(b.id)}
              />
            ))}
          </div>
        </section>
      )}

      {unscheduled.length > 0 && (
        <section>
          <Eyebrow>Unscheduled</Eyebrow>
          <div className="border-t border-hairline">
            {unscheduled.map(({ task, remaining }) => (
              <UnscheduledRow
                key={task.id}
                task={task}
                remaining={remaining}
                onClick={() => app.scheduleTask(task.id)}
              />
            ))}
          </div>
        </section>
      )}

      {doneToday.length > 0 && (
        <section>
          <Eyebrow>Done</Eyebrow>
          {doneCollapsed ? (
            <button
              onClick={() => setShowDone(true)}
              className="border-t border-hairline py-4 text-label text-graphite"
            >
              {doneToday.length} done
            </button>
          ) : (
            <div className="border-t border-hairline">
              {doneToday.map((b) => (
                <BlockRow
                  key={b.id}
                  block={b}
                  task={taskById.get(b.taskId)}
                  lane={laneOf(b)}
                  done
                  settling={justDoneId === b.id}
                  onClick={() => app.uncompleteBlock(b.id)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Gentle nudge toward the control surface when the day is empty. */}
      {notDone.length === 0 && unscheduled.length === 0 && doneToday.length === 0 && (
        <button
          onClick={onOpenChat}
          className="mt-6 text-label text-graphite underline decoration-hairline underline-offset-4"
        >
          Ask Deck to plan something
        </button>
      )}
    </div>
  )
}

function UnscheduledRow({
  task,
  remaining,
  onClick,
}: {
  task: Task
  remaining: number
  onClick: () => void
}) {
  return (
    <button className="flex h-14 w-full items-center gap-3 border-t border-hairline pl-3 pr-4 text-left first:border-t-0" onClick={onClick}>
      <span
        aria-hidden
        className="my-2 w-[3px] shrink-0 self-stretch rounded-full"
        style={{ backgroundColor: laneVar(task.lane) }}
      />
      <span className="min-w-0 flex-1 truncate text-body text-ink">{task.title}</span>
      <span className="shrink-0 text-label tabular-nums text-graphite">
        {formatDuration(remaining)}
      </span>
    </button>
  )
}

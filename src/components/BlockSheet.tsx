import { useApp } from '../state/AppContext'
import { Sheet } from './Sheet'
import { laneVar } from '../lib/lanes'
import {
  formatDuration,
  formatShortDate,
  formatTimeRange,
  minutesBetween,
} from '../lib/time'

// Tapping a block opens this: what it is, when, and the two things you can do.
export function BlockSheet({ blockId, onClose }: { blockId: string | null; onClose: () => void }) {
  const app = useApp()
  const block = blockId ? app.blocks.find((b) => b.id === blockId) : undefined
  const task = block ? app.tasks.find((t) => t.id === block.taskId) : undefined
  const course = task?.courseId ? app.courses.find((c) => c.id === task.courseId) : undefined

  return (
    <Sheet open={!!block} onClose={onClose} label="Block details">
      {block && task && (
        <div className="px-6 pb-8 pt-4">
          <div className="mb-1 flex items-center gap-2">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: laneVar(task.lane) }}
            />
            <span className="text-micro uppercase text-graphite">
              {course?.short ?? task.lane}
            </span>
          </div>

          <h2 className="text-title text-ink">{task.title}</h2>

          <dl className="mt-4 space-y-2 text-label">
            <div className="flex justify-between">
              <dt className="text-graphite">When</dt>
              <dd className="tabular-nums text-ink">{formatTimeRange(block.start, block.end)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-graphite">Duration</dt>
              <dd className="tabular-nums text-ink">
                {formatDuration(minutesBetween(block.start, block.end))}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-graphite">Due</dt>
              <dd className="text-ink">{formatShortDate(task.dueAt)}</dd>
            </div>
          </dl>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={() => {
                void app.skipBlock(block.id)
                onClose()
              }}
              className="flex-1 rounded-control py-3 text-label font-medium text-white"
              style={{ backgroundColor: laneVar('school') }}
            >
              Reschedule
            </button>
            <button
              onClick={() => {
                void app.deleteBlock(block.id)
                onClose()
              }}
              className="px-4 py-3 text-label font-medium text-graphite"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

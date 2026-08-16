import type { Block, Lane, Task } from '../types'
import { laneVar } from '../lib/lanes'
import { formatDuration, formatTime, minutesBetween } from '../lib/time'

interface BlockRowProps {
  block: Block
  task: Task | undefined
  lane: Lane
  done?: boolean
  completing?: boolean
  settling?: boolean
  onClick?: () => void
}

// A single 56px row: 3px lane bar, time, title, duration. The only separators
// in these lists are hairline dividers between rows.
export function BlockRow({
  block,
  task,
  lane,
  done = false,
  completing = false,
  settling = false,
  onClick,
}: BlockRowProps) {
  const minutes = minutesBetween(block.start, block.end)
  const className = [
    'flex items-center gap-3 h-14 pl-3 pr-1 border-t border-hairline first:border-t-0 text-left w-full',
    done ? 'opacity-50' : '',
    completing ? 'deck-completing' : '',
    settling ? 'deck-settling' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const Wrapper = onClick ? 'button' : 'div'

  return (
    <Wrapper className={className} onClick={onClick}>
      <span
        aria-hidden
        className="w-[3px] self-stretch my-2 rounded-full shrink-0"
        style={{ backgroundColor: laneVar(lane) }}
      />
      <span className="text-label text-graphite tabular-nums w-11 shrink-0">
        {formatTime(block.start)}
      </span>
      <span
        className={`text-body flex-1 min-w-0 truncate ${done ? 'line-through' : 'text-ink'}`}
      >
        {task?.title ?? 'Task'}
      </span>
      {done ? (
        <svg
          className="w-4 h-4 mr-3 shrink-0 text-moss"
          viewBox="0 0 16 16"
          fill="none"
          aria-label="done"
        >
          <path
            d="M3.5 8.5l3 3 6-6.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <span className="text-label text-graphite tabular-nums mr-3 shrink-0">
          {formatDuration(minutes)}
        </span>
      )}
    </Wrapper>
  )
}

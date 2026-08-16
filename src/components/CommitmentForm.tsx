import { useState } from 'react'

// Monday-first day chips; value is the JS getDay() index (0=Sun … 6=Sat).
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
export const DAY_LABEL: Record<number, string> = {
  0: 'S',
  1: 'M',
  2: 'T',
  3: 'W',
  4: 'T',
  5: 'F',
  6: 'S',
}

export interface CommitmentInput {
  label: string
  daysOfWeek: number[]
  startTime: string
  endTime: string
}

// Composer for a recurring weekly commitment (club, training, sleep…). Reused
// by the + sheet's "Recurring" tab and by Settings.
export function CommitmentForm({
  onAdd,
  placeholder = 'Name (e.g. Chess club)',
}: {
  onAdd: (c: CommitmentInput) => void | Promise<unknown>
  placeholder?: string
}) {
  const [label, setLabel] = useState('')
  const [days, setDays] = useState<Set<number>>(new Set())
  const [start, setStart] = useState('16:00')
  const [end, setEnd] = useState('17:00')

  const toggle = (d: number) =>
    setDays((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })

  async function submit() {
    if (!label.trim() || days.size === 0) return
    await onAdd({ label, daysOfWeek: [...days], startTime: start, endTime: end })
    setLabel('')
    setDays(new Set())
    setStart('16:00')
    setEnd('17:00')
  }

  return (
    <div className="rounded-control border border-hairline p-3">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={placeholder}
        className="mb-3 w-full bg-transparent text-body text-ink placeholder:text-graphite focus:outline-none"
      />
      <div className="mb-3 flex gap-1.5">
        {DAY_ORDER.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => toggle(d)}
            className={`h-8 w-8 rounded-full text-label transition-colors ${
              days.has(d) ? 'bg-primary text-white' : 'border border-hairline text-graphite'
            }`}
          >
            {DAY_LABEL[d]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="rounded-control border border-hairline bg-paper px-2 py-1.5 text-label text-ink focus:outline-none"
        />
        <span className="text-graphite">–</span>
        <input
          type="time"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="rounded-control border border-hairline bg-paper px-2 py-1.5 text-label text-ink focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!label.trim() || days.size === 0}
          className="ml-auto rounded-control bg-primary px-4 py-1.5 text-label font-medium text-white disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  )
}

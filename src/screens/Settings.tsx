import { useState } from 'react'
import { useApp } from '../state/AppContext'
import type { Availability } from '../types'
import { clearAnthropicKey, getAnthropicKey, setAnthropicKey } from '../lib/anthropic'
import { getGoogleClientId, setGoogleClientId } from '../lib/google'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-hairline px-6 py-5">
      <h3 className="mb-3 text-micro uppercase text-graphite">{title}</h3>
      {children}
    </section>
  )
}

// Monday-first day chips; value is the JS getDay() index (0=Sun … 6=Sat).
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DAY_LABEL: Record<number, string> = { 0: 'S', 1: 'M', 2: 'T', 3: 'W', 4: 'T', 5: 'F', 6: 'S' }

function daysSummary(days: number[]): string {
  return DAY_ORDER.filter((d) => days.includes(d))
    .map((d) => DAY_LABEL[d])
    .join(' ')
}

export function Settings() {
  const app = useApp()
  const [keyDraft, setKeyDraft] = useState(getAnthropicKey() ?? '')
  const [keySaved, setKeySaved] = useState(false)
  const [clientDraft, setClientDraft] = useState(getGoogleClientId() ?? '')
  const [googleError, setGoogleError] = useState<string | null>(null)

  // Commitment composer
  const [cLabel, setCLabel] = useState('')
  const [cDays, setCDays] = useState<Set<number>>(new Set())
  const [cStart, setCStart] = useState('16:00')
  const [cEnd, setCEnd] = useState('17:00')

  function saveKey() {
    if (keyDraft.trim()) setAnthropicKey(keyDraft)
    else clearAnthropicKey()
    app.refreshKey()
    setKeySaved(true)
    setTimeout(() => setKeySaved(false), 1500)
  }

  async function connect() {
    setGoogleError(null)
    if (clientDraft.trim()) setGoogleClientId(clientDraft)
    try {
      await app.connectGoogle()
    } catch (err) {
      setGoogleError(err instanceof Error ? err.message : 'Could not connect')
    }
  }

  async function addCommitment() {
    if (!cLabel.trim() || cDays.size === 0) return
    await app.addCommitment({
      label: cLabel,
      daysOfWeek: [...cDays],
      startTime: cStart,
      endTime: cEnd,
    })
    setCLabel('')
    setCDays(new Set())
    setCStart('16:00')
    setCEnd('17:00')
  }

  const toggleDay = (d: number) =>
    setCDays((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })

  const sortedCommitments = [...app.availability].sort((a, b) =>
    a.startTime.localeCompare(b.startTime),
  )

  return (
    <div className="pb-28 pt-8">
      <h1 className="px-6 pb-2 text-[26px] font-medium leading-tight text-ink">Settings</h1>

      <Section title="Assistant">
        <p className="mb-2 text-label text-graphite">
          Your Anthropic API key stays on this device and is never uploaded.
        </p>
        <input
          type="password"
          value={keyDraft}
          onChange={(e) => setKeyDraft(e.target.value)}
          placeholder="sk-ant-…"
          className="mb-3 w-full rounded-control border border-hairline bg-paper px-3 py-2 text-label text-ink focus:border-primary focus:outline-none"
        />
        <button
          onClick={saveKey}
          className="rounded-control bg-primary px-4 py-2 text-label font-medium text-white"
        >
          {keySaved ? 'Saved' : 'Save key'}
        </button>
      </Section>

      <Section title="Google Calendar">
        {app.calendarConnected ? (
          <div className="flex items-center justify-between">
            <span className="text-label text-ink">Connected</span>
            <button onClick={app.disconnectGoogle} className="text-label font-medium text-primary">
              Disconnect
            </button>
          </div>
        ) : (
          <>
            <p className="mb-2 text-label text-graphite">
              OAuth client ID (Web application) from Google Cloud Console. Client-side only.
            </p>
            <input
              value={clientDraft}
              onChange={(e) => setClientDraft(e.target.value)}
              placeholder="xxxx.apps.googleusercontent.com"
              className="mb-3 w-full rounded-control border border-hairline bg-paper px-3 py-2 text-label text-ink focus:border-primary focus:outline-none"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={connect}
                className="rounded-control bg-primary px-4 py-2 text-label font-medium text-white disabled:opacity-40"
                disabled={!clientDraft.trim()}
              >
                {app.calendarConfigured ? 'Reconnect' : 'Connect'}
              </button>
              {googleError && <span className="text-label text-graphite">{googleError}</span>}
            </div>
          </>
        )}
      </Section>

      <Section title="Commitments">
        <p className="mb-3 text-label text-graphite">
          Recurring things that block study time and show on your calendar — clubs, training,
          school, sleep.
        </p>

        {sortedCommitments.length > 0 && (
          <ul className="mb-4">
            {sortedCommitments.map((a) => (
              <CommitmentRow key={a.id} a={a} onDelete={() => app.deleteCommitment(a.id)} />
            ))}
          </ul>
        )}

        {/* Composer */}
        <div className="rounded-control border border-hairline p-3">
          <input
            value={cLabel}
            onChange={(e) => setCLabel(e.target.value)}
            placeholder="Name (e.g. Chess club)"
            className="mb-3 w-full bg-transparent text-body text-ink placeholder:text-graphite focus:outline-none"
          />
          <div className="mb-3 flex gap-1.5">
            {DAY_ORDER.map((d) => (
              <button
                key={d}
                onClick={() => toggleDay(d)}
                className={`h-8 w-8 rounded-full text-label transition-colors ${
                  cDays.has(d) ? 'bg-primary text-white' : 'border border-hairline text-graphite'
                }`}
              >
                {DAY_LABEL[d]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={cStart}
              onChange={(e) => setCStart(e.target.value)}
              className="rounded-control border border-hairline bg-paper px-2 py-1.5 text-label text-ink focus:outline-none"
            />
            <span className="text-graphite">–</span>
            <input
              type="time"
              value={cEnd}
              onChange={(e) => setCEnd(e.target.value)}
              className="rounded-control border border-hairline bg-paper px-2 py-1.5 text-label text-ink focus:outline-none"
            />
            <button
              onClick={addCommitment}
              disabled={!cLabel.trim() || cDays.size === 0}
              className="ml-auto rounded-control bg-primary px-4 py-1.5 text-label font-medium text-white disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      </Section>

      <Section title="Planning">
        <p className="text-label text-graphite">
          Deck plans your study sessions automatically. To change how — shorter sessions, more per
          day, a bigger buffer before deadlines — just tell the assistant in chat.
        </p>
      </Section>
    </div>
  )
}

function CommitmentRow({ a, onDelete }: { a: Availability; onDelete: () => void }) {
  return (
    <li className="flex items-center gap-3 border-b border-hairline py-2.5 last:border-b-0">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body text-ink">{a.label}</span>
        <span className="text-label text-graphite tabular-nums">
          {daysSummary(a.daysOfWeek)} · {a.startTime}–{a.endTime}
        </span>
      </span>
      <button
        onClick={onDelete}
        aria-label={`Remove ${a.label}`}
        className="grid h-8 w-8 place-items-center rounded-full text-graphite hover:bg-hairline/50"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </li>
  )
}

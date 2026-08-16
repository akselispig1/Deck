import { useState } from 'react'
import { useApp } from '../state/AppContext'
import type { Availability, Course, Lane } from '../types'
import { clearAnthropicKey, getAnthropicKey, setAnthropicKey } from '../lib/anthropic'
import { getGoogleClientId, setGoogleClientId } from '../lib/google'
import { LANE_ORDER, LANES, laneVar } from '../lib/lanes'
import { CommitmentForm, DAY_LABEL, DAY_ORDER } from '../components/CommitmentForm'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-hairline px-6 py-5">
      <h3 className="mb-3 text-micro uppercase text-graphite">{title}</h3>
      {children}
    </section>
  )
}

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

  // Subject composer
  const [subjName, setSubjName] = useState('')
  const [subjLane, setSubjLane] = useState<Lane>('school')

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

  async function addSubject() {
    if (!subjName.trim()) return
    await app.addCourse({ name: subjName, colorKey: subjLane })
    setSubjName('')
    setSubjLane('school')
  }

  const commitments = [...app.availability].sort((a, b) => a.startTime.localeCompare(b.startTime))
  const courses = [...app.courses].sort((a, b) => a.name.localeCompare(b.name))

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

      <Section title="Subjects">
        <p className="mb-3 text-label text-graphite">
          Categories you can tag tasks with — school subjects, side projects, cycling, anything.
        </p>

        {courses.length > 0 && (
          <ul className="mb-4">
            {courses.map((c) => (
              <SubjectRow key={c.id} c={c} onDelete={() => app.deleteCourse(c.id)} />
            ))}
          </ul>
        )}

        <div className="rounded-control border border-hairline p-3">
          <input
            value={subjName}
            onChange={(e) => setSubjName(e.target.value)}
            placeholder="Name (e.g. Cycling)"
            className="mb-3 w-full bg-transparent text-body text-ink placeholder:text-graphite focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <div className="flex flex-1 gap-2 overflow-x-auto">
              {LANE_ORDER.map((l) => (
                <button
                  key={l}
                  onClick={() => setSubjLane(l)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-label transition-colors ${
                    subjLane === l ? 'text-white' : 'border border-hairline text-graphite'
                  }`}
                  style={subjLane === l ? { backgroundColor: laneVar(l) } : undefined}
                >
                  {LANES[l].label}
                </button>
              ))}
            </div>
            <button
              onClick={addSubject}
              disabled={!subjName.trim()}
              className="rounded-control bg-primary px-4 py-1.5 text-label font-medium text-white disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      </Section>

      <Section title="Commitments">
        <p className="mb-3 text-label text-graphite">
          Recurring things that block study time and show on your calendar — clubs, training,
          school, sleep.
        </p>

        {commitments.length > 0 && (
          <ul className="mb-4">
            {commitments.map((a) => (
              <CommitmentRow key={a.id} a={a} onDelete={() => app.deleteCommitment(a.id)} />
            ))}
          </ul>
        )}

        <CommitmentForm onAdd={app.addCommitment} />
      </Section>

      <Section title="Planning">
        <p className="text-label text-graphite">
          Deck plans your study sessions automatically. To change how — shorter sessions, more per
          day, a bigger buffer before deadlines — just tell the assistant.
        </p>
      </Section>
    </div>
  )
}

function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-graphite hover:bg-hairline/50"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  )
}

function SubjectRow({ c, onDelete }: { c: Course; onDelete: () => void }) {
  return (
    <li className="flex items-center gap-3 border-b border-hairline py-2.5 last:border-b-0">
      <span
        aria-hidden
        className="h-3 w-3 shrink-0 rounded-full"
        style={{ backgroundColor: laneVar(c.colorKey) }}
      />
      <span className="min-w-0 flex-1 truncate text-body text-ink">{c.name}</span>
      <DeleteButton label={`Remove ${c.name}`} onClick={onDelete} />
    </li>
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
      <DeleteButton label={`Remove ${a.label}`} onClick={onDelete} />
    </li>
  )
}

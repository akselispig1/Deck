import { useState } from 'react'
import { useApp } from '../state/AppContext'
import { laneVar } from '../lib/lanes'
import {
  clearAnthropicKey,
  getAnthropicKey,
  setAnthropicKey,
} from '../lib/anthropic'
import { getGoogleClientId, setGoogleClientId } from '../lib/google'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-hairline px-6 py-5">
      <h3 className="mb-3 text-micro uppercase text-graphite">{title}</h3>
      {children}
    </section>
  )
}

function Stepper({
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  value: number
  onChange: (n: number) => void
  min: number
  max: number
  suffix?: string
}) {
  const set = (n: number) => onChange(Math.min(max, Math.max(min, n)))
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => set(value - 1)}
        className="grid h-8 w-8 place-items-center rounded-full border border-hairline text-ink"
      >
        –
      </button>
      <span className="w-16 text-center text-label tabular-nums text-ink">
        {value}
        {suffix ? ` ${suffix}` : ''}
      </span>
      <button
        onClick={() => set(value + 1)}
        className="grid h-8 w-8 place-items-center rounded-full border border-hairline text-ink"
      >
        +
      </button>
    </div>
  )
}

export function Settings() {
  const app = useApp()
  const [keyDraft, setKeyDraft] = useState(getAnthropicKey() ?? '')
  const [keySaved, setKeySaved] = useState(false)
  const [clientDraft, setClientDraft] = useState(getGoogleClientId() ?? '')
  const [googleError, setGoogleError] = useState<string | null>(null)

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

  return (
    <div className="pb-28 pt-10">
      <h1 className="px-6 pb-4 text-[26px] font-semibold leading-tight text-ink">Settings</h1>

      <Section title="Claude">
        <p className="mb-2 text-label text-graphite">
          Your Anthropic API key stays on this device (localStorage) and is never uploaded.
        </p>
        <input
          type="password"
          value={keyDraft}
          onChange={(e) => setKeyDraft(e.target.value)}
          placeholder="sk-ant-…"
          className="mb-3 w-full rounded-control border border-hairline bg-paper px-3 py-2 text-label text-ink focus:outline-none"
        />
        <button
          onClick={saveKey}
          className="rounded-control px-4 py-2 text-label font-medium text-white"
          style={{ backgroundColor: laneVar('school') }}
        >
          {keySaved ? 'Saved' : 'Save key'}
        </button>
      </Section>

      <Section title="Google Calendar">
        {app.calendarConnected ? (
          <div className="flex items-center justify-between">
            <span className="text-label text-ink">Connected</span>
            <button onClick={app.disconnectGoogle} className="text-label text-graphite">
              Disconnect
            </button>
          </div>
        ) : (
          <>
            <p className="mb-2 text-label text-graphite">
              OAuth client ID (Web application) from Google Cloud Console. Client-side only — no
              secret.
            </p>
            <input
              value={clientDraft}
              onChange={(e) => setClientDraft(e.target.value)}
              placeholder="xxxx.apps.googleusercontent.com"
              className="mb-3 w-full rounded-control border border-hairline bg-paper px-3 py-2 text-label text-ink focus:outline-none"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={connect}
                className="rounded-control px-4 py-2 text-label font-medium text-white disabled:opacity-40"
                style={{ backgroundColor: laneVar('school') }}
                disabled={!clientDraft.trim()}
              >
                {app.calendarConfigured ? 'Reconnect calendar' : 'Connect calendar'}
              </button>
              {googleError && <span className="text-label text-graphite">{googleError}</span>}
            </div>
          </>
        )}
      </Section>

      <Section title="Scheduling">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-label text-ink">Block length</span>
            <Stepper
              value={app.settings.blockLengthMinutes}
              min={15}
              max={90}
              suffix="min"
              onChange={(n) => app.updateSettings({ blockLengthMinutes: n })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-label text-ink">Max blocks / evening</span>
            <Stepper
              value={app.settings.maxBlocksPerEvening}
              min={1}
              max={6}
              onChange={(n) => app.updateSettings({ maxBlocksPerEvening: n })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-label text-ink">Buffer before due</span>
            <Stepper
              value={app.settings.bufferDays}
              min={0}
              max={5}
              suffix="d"
              onChange={(n) => app.updateSettings({ bufferDays: n })}
            />
          </div>
        </div>
        <button
          onClick={() => app.planWeek()}
          className="mt-5 rounded-control border border-hairline px-4 py-2 text-label text-ink"
        >
          Replan the week
        </button>
      </Section>
    </div>
  )
}

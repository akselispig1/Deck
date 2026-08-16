import { useEffect, useRef, useState } from 'react'
import { useApp } from '../state/AppContext'
import type { ChatMessage, ConfirmationStrip } from '../types'
import { laneVar } from '../lib/lanes'

const SUGGESTIONS = ['Plan my week', "I'm behind on chemistry", 'Move everything off Saturday']

export function Chat({ onOpenSettings }: { onOpenSettings: () => void }) {
  const app = useApp()
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [app.chatMessages.length, app.chatBusy])

  // No key → a quiet setup prompt instead of the composer (§9).
  if (!app.hasKey) {
    return (
      <div className="flex h-[100dvh] flex-col items-start justify-center gap-4 px-8">
        <h2 className="text-[26px] font-semibold leading-tight text-ink">Connect Claude</h2>
        <p className="max-w-xs text-body text-graphite">
          Add your Anthropic API key in Settings, then Deck can plan, reschedule and reason about
          your week here.
        </p>
        <button
          onClick={onOpenSettings}
          className="rounded-control bg-primary px-5 py-3 text-label font-medium text-white"
        >
          Open Settings
        </button>
      </div>
    )
  }

  function send(text: string) {
    const t = text.trim()
    if (!t || app.chatBusy) return
    setDraft('')
    void app.sendChat(t)
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-6 pt-10">
        {app.chatMessages.length === 0 && (
          <div className="pt-6">
            <p className="mb-4 text-body text-graphite">What can I take off your plate?</p>
            <div className="flex flex-col items-start gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-hairline px-4 py-2 text-label text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {app.chatMessages.map((m) => (
          <Message key={m.id} message={m} />
        ))}

        {app.chatBusy && (
          <p className="text-body text-graphite" aria-live="polite">
            Thinking…
          </p>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div
        className="px-4 pt-2"
        style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(draft)
              }
            }}
            rows={1}
            placeholder="Ask Deck…"
            className="max-h-32 flex-1 resize-none rounded-control border border-hairline bg-paper px-3 py-2.5 text-body text-ink placeholder:text-graphite focus:outline-none"
          />
          <button
            onClick={() => send(draft)}
            disabled={!draft.trim() || app.chatBusy}
            aria-label="Send"
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-white transition-colors disabled:opacity-40 ${
              draft.trim() ? 'bg-primary' : 'bg-primary/40'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

function Message({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-primary/10 px-3.5 py-2 text-body text-ink">
          {message.text}
        </div>
      </div>
    )
  }
  // Claude: no bubble, plain ink text, full width.
  return (
    <div className="space-y-2">
      {message.text && <p className="whitespace-pre-wrap text-body text-ink">{message.text}</p>}
      {message.strips?.map((s, i) => (
        <Strip key={i} strip={s} />
      ))}
    </div>
  )
}

function Strip({ strip }: { strip: ConfirmationStrip }) {
  return (
    <div className="flex items-center gap-2 rounded-control border border-hairline px-3 py-2">
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: laneVar(strip.lane) }}
      />
      <span className="text-label text-graphite">{strip.text}</span>
    </div>
  )
}

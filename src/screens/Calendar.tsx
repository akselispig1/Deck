import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../state/AppContext'

// Google Calendar, shown through. Deck writes its study blocks (and your
// commitments) into your Google calendars, and this embeds the real thing so
// everything lives in one Google-native view. The embed is a static iframe, so
// we reload it whenever the schedule changes (and on demand) so removals and
// additions actually show.
export function CalendarView({ onOpenSettings }: { onOpenSettings: () => void }) {
  const app = useApp()
  const primary = app.settings.googlePrimaryId
  const deckCal = app.settings.googleCalendarId

  const [nonce, setNonce] = useState(() => Date.now())
  const firstData = useRef(true)

  // Reload the embed shortly after the schedule changes (giving the async
  // Google write/delete time to land), so edits — yours or the assistant's —
  // show up rather than lingering.
  useEffect(() => {
    if (firstData.current) {
      firstData.current = false
      return
    }
    const t = setTimeout(() => setNonce(Date.now()), 1600)
    return () => clearTimeout(t)
  }, [app.blocks.length, app.availability.length])

  // Refresh when the app regains focus (e.g. back from Google).
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') setNonce(Date.now())
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const src = useMemo(() => {
    if (!primary) return null
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    const params = new URLSearchParams()
    params.set('ctz', tz)
    params.set('mode', 'WEEK')
    params.set('wkst', '2') // Monday
    params.set('showTitle', '0')
    params.set('showPrint', '0')
    params.set('showTabs', '1')
    params.set('showCalendars', '0')
    params.set('showTz', '0')
    let qs = params.toString()
    qs += `&src=${encodeURIComponent(primary)}`
    if (deckCal) qs += `&src=${encodeURIComponent(deckCal)}`
    qs += `&_r=${nonce}` // cache-bust so the iframe refetches
    return `https://calendar.google.com/calendar/embed?${qs}`
  }, [primary, deckCal, nonce])

  if (!src) {
    return (
      <div className="mx-auto flex min-h-[70dvh] w-full max-w-[560px] flex-col items-start justify-center gap-4 px-6">
        <h2 className="text-title text-ink">Connect your calendar</h2>
        <p className="max-w-sm text-body text-graphite">
          Link Google Calendar and Deck shows it right here — with your study blocks planned in
          alongside your real events.
        </p>
        <button
          onClick={onOpenSettings}
          className="rounded-control bg-primary px-5 py-2.5 text-label font-medium text-white"
        >
          Connect in Settings
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-title text-ink">Calendar</span>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setNonce(Date.now())}
            className="text-label font-medium text-primary"
            aria-label="Refresh calendar"
          >
            Refresh
          </button>
          <a
            href="https://calendar.google.com/"
            target="_blank"
            rel="noreferrer"
            className="text-label font-medium text-primary"
          >
            Open in Google&nbsp;↗
          </a>
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden border-t border-hairline">
        <iframe
          key={nonce}
          title="Google Calendar"
          src={src}
          className="h-full w-full border-0"
          style={{ colorScheme: 'normal' }}
        />
      </div>
      <p className="px-4 py-2 text-micro text-graphite">
        Blank? Make sure you're signed into Google in this browser (private calendars need your
        login). Your Deck study blocks show under the “Deck” calendar.
      </p>
    </div>
  )
}

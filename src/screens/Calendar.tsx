import { useMemo } from 'react'
import { useApp } from '../state/AppContext'

// Google Calendar, shown through. Deck writes its study blocks (and your
// commitments) into your Google calendars, and this embeds the real thing so
// everything lives in one Google-native view.
export function CalendarView({ onOpenSettings }: { onOpenSettings: () => void }) {
  const app = useApp()
  const primary = app.settings.googlePrimaryId
  const deckCal = app.settings.googleCalendarId

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
    // URLSearchParams encodes; append repeated src for each calendar.
    let qs = params.toString()
    qs += `&src=${encodeURIComponent(primary)}`
    if (deckCal) qs += `&src=${encodeURIComponent(deckCal)}`
    return `https://calendar.google.com/calendar/embed?${qs}`
  }, [primary, deckCal])

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
        <a
          href="https://calendar.google.com/"
          target="_blank"
          rel="noreferrer"
          className="text-label font-medium text-primary"
        >
          Open in Google&nbsp;↗
        </a>
      </div>
      <div className="relative flex-1 overflow-hidden border-t border-hairline">
        <iframe
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

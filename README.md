# Deck

A personal school planner that answers one question — **what should I work on right now** — and keeps everything else quiet until asked.

Deck turns a due date into a set of work sessions on a calendar and tells you which one is next. School work and side projects (CharQ, freelance, training) share one timeline, so clashes are visible instead of discovered at 11pm.

Runs entirely in the browser. No server, no accounts, no sync. All data lives in IndexedDB on the device. Installable as a PWA and works offline for everything except calendar sync and chat.

## Stack

- Vite + React + TypeScript
- Tailwind CSS (warm paper palette, light/dark via CSS variables)
- Dexie (IndexedDB)
- `vite-plugin-pwa` (manifest + offline service worker)
- `date-fns`
- Google Identity Services + Google Calendar API (client-side OAuth, no secret)
- Anthropic API, called directly from the browser

No component library, no state-management library — React context is enough.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173/Deck/
npm test           # scheduler unit tests (Vitest)
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build locally
```

## How it works

- **Today** — the Now card (the one thing at display scale) shows the next work session with a live countdown and a slowly-draining bar. Below it: Later today, Unscheduled, and a collapsing Done stack.
- **Week** — seven columns Mon–Sun. Availability windows are flat "unavailable ground"; work blocks sit in their lane colour. Drag a block (snaps to 15 min) to reschedule; tap one for details.
- **Chat** — the control surface. Claude reads and writes your tasks and schedule through tools; every change it makes shows an inline confirmation strip. Needs an Anthropic API key (below).
- **Add task** — the floating button opens a sheet: title, course, due date, estimate, lane.

### The scheduler

A pure, side-effect-free function (`src/scheduler/scheduler.ts`, covered by unit tests) turns open tasks into blocks:

1. Works backwards from the due date, leaving `bufferDays` clear before it.
2. Splits each estimate into `blockLengthMinutes` chunks (never a chunk under 15 min).
3. Never places work inside an availability window.
4. Never exceeds `maxBlocksPerEvening` on one day.
5. Earlier deadlines claim earlier slots.
6. Schedules what fits; the rest is shown plainly as **Unscheduled** — no warning styling, no "you're behind" meter.

## Configuration

Both integrations are optional and configured in **Settings** at runtime — nothing lives in the repo, an env file, or the build.

### Anthropic (Chat)

Enter your API key in Settings. It is stored in `localStorage` on the device only. Until a key is set, the Chat tab shows a setup prompt instead of the composer.

### Google Calendar

Client-side OAuth only — no client secret.

1. Google Cloud Console → enable the **Google Calendar API**.
2. Create an **OAuth client ID**, type **Web application**, with the GitHub Pages URL as an authorised JavaScript origin.
3. Keep the consent screen in **Testing** mode with yourself as the only test user.
4. Paste the client ID into Settings and connect.

On first connect Deck creates a dedicated calendar named **Deck**, so its blocks can be toggled off in Google Calendar without touching anything else. Each block becomes one event; notifications are Google's job. Access tokens are held in memory only (~1 hour) — on expiry Settings shows a quiet *Reconnect calendar* row.

## Deploy (GitHub Pages)

`base` in `vite.config.ts` is set to `/Deck/` to match the repository name. The included workflow (`.github/workflows/deploy.yml`) type-checks, tests, builds, and publishes `dist/` to GitHub Pages on every push to `main`.

To enable it once: repository **Settings → Pages → Build and deployment → Source: GitHub Actions**. The app is then served at `https://<user>.github.io/Deck/` — use that URL as the Google OAuth authorised origin.

## Out of scope

No Schoology integration, no risk score / streak / badge / productivity metric, no accounts or cross-device sync, no backend of any kind.

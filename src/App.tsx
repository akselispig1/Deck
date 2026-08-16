import { useState } from 'react'
import { useApp } from './state/AppContext'
import { TabBar, type Tab } from './components/TabBar'
import { Today } from './screens/Today'
import { CalendarView } from './screens/Calendar'
import { Chat } from './screens/Chat'
import { Settings } from './screens/Settings'
import { AddTaskSheet } from './components/AddTaskSheet'

export default function App() {
  const app = useApp()
  const [tab, setTab] = useState<Tab>('today')
  const [addOpen, setAddOpen] = useState(false)

  if (!app.ready) {
    return (
      <div className="grid min-h-[100dvh] place-items-center">
        <span className="text-title font-medium text-graphite">Deck</span>
      </div>
    )
  }

  const showFab = tab === 'today' || tab === 'calendar'
  const full = tab === 'calendar' // the embed fills the whole area

  return (
    <div className="min-h-[100dvh] md:pl-18">
      <main className={full ? 'w-full' : 'mx-auto w-full max-w-[560px]'}>
        {tab === 'today' && <Today onOpenChat={() => setTab('chat')} />}
        {tab === 'calendar' && <CalendarView onOpenSettings={() => setTab('settings')} />}
        {tab === 'chat' && <Chat onOpenSettings={() => setTab('settings')} />}
        {tab === 'settings' && <Settings />}
      </main>

      <TabBar current={tab} onChange={setTab} />

      {showFab && (
        <button
          onClick={() => setAddOpen(true)}
          aria-label="Add task"
          className="fixed right-4 z-40 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-white shadow-fab md:right-6"
          style={{ bottom: 'calc(76px + env(safe-area-inset-bottom))' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}

      <AddTaskSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}

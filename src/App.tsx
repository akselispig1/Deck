import { useState } from 'react'
import { useApp } from './state/AppContext'
import { TabBar, type Tab } from './components/TabBar'
import { Today } from './screens/Today'
import { Week } from './screens/Week'
import { Chat } from './screens/Chat'
import { Settings } from './screens/Settings'
import { AddTaskSheet } from './components/AddTaskSheet'
import { laneVar } from './lib/lanes'

export default function App() {
  const app = useApp()
  const [tab, setTab] = useState<Tab>('today')
  const [addOpen, setAddOpen] = useState(false)

  if (!app.ready) {
    return (
      <div className="grid min-h-[100dvh] place-items-center">
        <span className="text-title text-graphite">Deck</span>
      </div>
    )
  }

  const showFab = tab === 'today' || tab === 'week'

  return (
    <div className="min-h-[100dvh]">
      <main className="mx-auto w-full max-w-content">
        {tab === 'today' && <Today onOpenChat={() => setTab('chat')} />}
        {tab === 'week' && <Week />}
        {tab === 'chat' && <Chat onOpenSettings={() => setTab('settings')} />}
        {tab === 'settings' && <Settings />}
      </main>

      <TabBar current={tab} onChange={setTab} />

      {/* Floating add button, anchored to the content column's bottom-right. */}
      {showFab && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center">
          <div className="relative w-full max-w-content">
            <button
              onClick={() => setAddOpen(true)}
              aria-label="Add task"
              className="pointer-events-auto absolute right-5 grid h-14 w-14 place-items-center rounded-full text-white shadow-fab"
              style={{
                backgroundColor: laneVar('school'),
                bottom: 'calc(72px + env(safe-area-inset-bottom))',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <AddTaskSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}

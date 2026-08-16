import type { ReactNode } from 'react'

export type Tab = 'today' | 'calendar' | 'chat' | 'settings'

interface TabDef {
  id: Tab
  label: string
  icon: ReactNode
}

const iconProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const TABS: TabDef[] = [
  {
    id: 'today',
    label: 'Today',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="4" width="18" height="17" rx="2.5" />
        <path d="M3 9h18M8 2v4M16 2v4" />
      </svg>
    ),
  },
  {
    id: 'chat',
    label: 'Assistant',
    icon: (
      <svg {...iconProps}>
        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9A1.5 1.5 0 0 1 18.5 16H9l-5 4z" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2.5l1.3 2.2 2.5-.6.3 2.6 2.3 1.2-1 2.4 1 2.4-2.3 1.2-.3 2.6-2.5-.6L12 21.5l-1.3-2.2-2.5.6-.3-2.6L5.6 16l1-2.4-1-2.4 2.3-1.2.3-2.6 2.5.6z" />
      </svg>
    ),
  },
]

export function TabBar({ current, onChange }: { current: Tab; onChange: (t: Tab) => void }) {
  const Item = ({ tab, rail }: { tab: TabDef; rail?: boolean }) => {
    const active = tab.id === current
    return (
      <button
        onClick={() => onChange(tab.id)}
        aria-current={active ? 'page' : undefined}
        className={[
          'flex flex-col items-center gap-1 transition-colors',
          rail ? 'w-full py-3' : 'flex-1 py-2',
          active ? 'text-primary' : 'text-graphite',
        ].join(' ')}
      >
        {/* Material pill highlight behind the active icon */}
        <span
          className={`flex h-8 w-16 items-center justify-center rounded-full transition-colors ${
            active ? 'bg-primary/10' : ''
          }`}
        >
          {tab.icon}
        </span>
        <span className="text-micro">{tab.label}</span>
      </button>
    )
  }

  return (
    <>
      {/* Bottom navigation — mobile */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-card md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch px-1">
          {TABS.map((t) => (
            <Item key={t.id} tab={t} />
          ))}
        </div>
      </nav>

      {/* Navigation rail — desktop */}
      <nav className="fixed left-0 top-0 z-30 hidden h-full w-18 flex-col items-center gap-2 border-r border-hairline bg-card px-1 py-5 md:flex">
        {TABS.map((t) => (
          <Item key={t.id} tab={t} rail />
        ))}
      </nav>
    </>
  )
}

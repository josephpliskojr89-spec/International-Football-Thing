import { useGame, type Route } from '@/state/store'

interface MenuEntry {
  route: Route
  icon: string
  label: string
  sub: string
  danger?: boolean
}

const ENTRIES: MenuEntry[] = [
  { route: 'squad', icon: '⚽', label: 'Squad', sub: 'Formation, XI & tactics' },
  { route: 'standings', icon: '🏆', label: 'Qualifying', sub: 'Group table & results' },
  { route: 'pool', icon: '👥', label: 'Player Pool', sub: 'Everyone available to you' },
  { route: 'dual-nationals', icon: '🌍', label: 'Dual Nationals', sub: 'Eligible, not yet committed' },
  { route: 'scouting', icon: '🧭', label: 'Scouting', sub: 'Assign coaches to leagues' },
  { route: 'settings', icon: '⚙️', label: 'Settings', sub: 'Volume & difficulty' },
  { route: 'save', icon: '💾', label: 'Save Game', sub: 'Your career is auto-saved' },
]

export function MenuSheet({ onClose }: { onClose: () => void }) {
  const go = useGame((s) => s.go)
  const tournament = useGame((s) => s.career?.tournament)

  const navigate = (route: Route) => {
    onClose()
    go(route)
  }

  // The Finals entry only appears while a summer tournament is live.
  const entries: MenuEntry[] = tournament
    ? [
        { route: 'bracket', icon: '🏆', label: tournament.name, sub: 'Bracket & results' },
        ...ENTRIES.filter((e) => e.route !== 'standings'),
      ]
    : ENTRIES

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grip" />
        {entries.map((e) => (
          <button key={e.route} className="menu-item" onClick={() => navigate(e.route)}>
            <span className="menu-item__icon">{e.icon}</span>
            <span style={{ flex: 1 }}>
              <div>{e.label}</div>
              <div className="menu-item__sub">{e.sub}</div>
            </span>
            <span className="faint">›</span>
          </button>
        ))}
        <button className="menu-item menu-item--danger" onClick={() => navigate('title')}>
          <span className="menu-item__icon">⏏️</span>
          <span style={{ flex: 1 }}>
            <div>Main Menu</div>
            <div className="menu-item__sub">Return to title (progress is saved)</div>
          </span>
        </button>
      </div>
    </div>
  )
}

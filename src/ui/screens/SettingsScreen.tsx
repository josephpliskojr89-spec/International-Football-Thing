import { useGame } from '@/state/store'

// Volume and difficulty are present but grayed out — music ships later, and
// difficulty modifiers are a later milestone. Reachable from both the title
// screen (no career) and the in-career menu.
export function SettingsScreen() {
  const go = useGame((s) => s.go)
  const career = useGame((s) => s.career)

  return (
    <div className="screen">
      <div className="topbar">
        <button
          className="iconbtn"
          onClick={() => go(career ? 'schedule' : 'title')}
          aria-label="Back"
        >
          ‹
        </button>
        <div className="topbar__title">Settings</div>
      </div>

      <div className="screen__body">
        <div className="card" style={{ opacity: 0.5 }}>
          <div className="field-label">Music & Sound</div>
          <input type="range" min={0} max={100} defaultValue={70} disabled style={{ width: '100%' }} />
          <div className="faint" style={{ fontSize: 13 }}>
            Coming soon — volume controls activate when the soundtrack ships.
          </div>
        </div>

        <div className="card" style={{ opacity: 0.5 }}>
          <div className="field-label">Difficulty</div>
          <div className="segmented">
            <button disabled>Relaxed</button>
            <button className="on" disabled>
              Normal
            </button>
            <button disabled>Hard</button>
          </div>
          <div className="faint" style={{ fontSize: 13, marginTop: 8 }}>
            Coming soon — difficulty modifiers are on the way.
          </div>
        </div>

        <div className="card">
          <div className="field-label">About</div>
          <div className="muted" style={{ fontSize: 14 }}>
            National Team Manager — a colorful, offline-first international management game.
          </div>
          <div
            className="faint"
            style={{ fontSize: 13, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}
          >
            Build v{__APP_VERSION__} · {__BUILD_HASH__} · {__BUILD_DATE__}
          </div>
        </div>
      </div>
    </div>
  )
}

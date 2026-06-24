import { useEffect, useState } from 'react'
import { useGame } from '@/state/store'
import { hasSave } from '@/state/persist'

export function TitleScreen() {
  const go = useGame((s) => s.go)
  const continueCareer = useGame((s) => s.continueCareer)
  const [saveExists, setSaveExists] = useState(false)

  useEffect(() => {
    void hasSave().then(setSaveExists)
  }, [])

  return (
    <div className="screen">
      <div className="title-wrap">
        <div className="title-logo">
          National
          <br />
          Team Manager
        </div>
        <div className="title-tag">
          Pick a nation. Build a squad. Chase the World Cup.
        </div>

        <button className="btn btn--primary btn--lg btn--block" onClick={() => go('new-game')}>
          New Game
        </button>
        <button
          className="btn btn--lg btn--block"
          disabled={!saveExists}
          onClick={async () => {
            const ok = await continueCareer()
            if (!ok) setSaveExists(false)
          }}
        >
          Continue
        </button>
        <button className="btn btn--ghost btn--lg btn--block" onClick={() => go('settings')}>
          Settings
        </button>

        <div className="faint" style={{ marginTop: 18, fontSize: 12 }}>
          v0.1 · offline-ready
        </div>
      </div>
    </div>
  )
}

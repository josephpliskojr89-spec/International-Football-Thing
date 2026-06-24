import { useState } from 'react'
import { useGame } from '@/state/store'
import { InCareerHeader } from '../components/InCareerHeader'

export function SaveScreen() {
  const career = useGame((s) => s.career)!
  const saveNow = useGame((s) => s.saveNow)
  const abandonCareer = useGame((s) => s.abandonCareer)
  const [saved, setSaved] = useState(false)
  const [confirmAbandon, setConfirmAbandon] = useState(false)

  return (
    <div className="screen">
      <InCareerHeader title="Save Game" />

      <div className="screen__body">
        <div className="card">
          <div style={{ fontWeight: 800, marginBottom: 4 }}>{career.managerName}</div>
          <div className="muted" style={{ fontSize: 14 }}>
            Cycle Year {career.year} · Week {career.week}
          </div>
          <div className="faint" style={{ fontSize: 13, marginTop: 10 }}>
            Your career auto-saves as you play. You can force a save here too.
          </div>
        </div>

        <button
          className="btn btn--primary btn--lg btn--block"
          onClick={async () => {
            await saveNow()
            setSaved(true)
            setTimeout(() => setSaved(false), 1500)
          }}
        >
          {saved ? 'Saved ✓' : 'Save Now'}
        </button>

        {!confirmAbandon ? (
          <button
            className="btn btn--ghost btn--block"
            style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }}
            onClick={() => setConfirmAbandon(true)}
          >
            Abandon Career
          </button>
        ) : (
          <div className="card" style={{ borderColor: 'var(--bad)' }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              Delete this career permanently?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn--block"
                style={{ background: 'var(--bad)', color: '#fff' }}
                onClick={() => void abandonCareer()}
              >
                Delete
              </button>
              <button className="btn btn--ghost btn--block" onClick={() => setConfirmAbandon(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

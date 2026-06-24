import { useState } from 'react'
import { useGame } from '@/state/store'
import { NATIONS, CONFEDERATION_NAMES } from '@/data/nations'
import { FORMATIONS } from '@/data/formations'
import type { ManagerStyle } from '@/engine/types'

type Approach = ManagerStyle['approach']
type Pref = ManagerStyle['preference']

export function NewGameScreen() {
  const go = useGame((s) => s.go)
  const startNewCareer = useGame((s) => s.startNewCareer)

  const [step, setStep] = useState(0)
  const [nationId, setNationId] = useState<string | null>(null)
  const [managerName, setManagerName] = useState('')
  const [formation, setFormation] = useState('4-3-3')
  const [approach, setApproach] = useState<Approach>('Balanced')
  const [preference, setPreference] = useState<Pref>('Balanced')

  const back = () => (step === 0 ? go('title') : setStep(step - 1))

  const canNext =
    (step === 0 && nationId) ||
    (step === 1 && managerName.trim().length > 0) ||
    step === 2

  const next = async () => {
    if (step < 2) {
      setStep(step + 1)
      return
    }
    await startNewCareer({
      managerName,
      nationId: nationId!,
      style: { formation, approach, preference },
    })
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="iconbtn" onClick={back} aria-label="Back">
          ‹
        </button>
        <div>
          <div className="topbar__title">New Game</div>
          <div className="topbar__sub">
            {['Choose your nation', 'Name your manager', 'Pick your style'][step]}
          </div>
        </div>
      </div>

      <div className="stepper">
        {[0, 1, 2].map((i) => (
          <i key={i} className={i <= step ? 'on' : ''} />
        ))}
      </div>

      <div className="screen__body">
        {step === 0 && <NationStep selected={nationId} onSelect={setNationId} />}

        {step === 1 && (
          <div className="card">
            <div className="field-label">Manager name</div>
            <input
              className="text-input"
              placeholder="Enter your name"
              value={managerName}
              maxLength={28}
              autoFocus
              onChange={(e) => setManagerName(e.target.value)}
            />
            <div className="faint" style={{ marginTop: 10, fontSize: 13 }}>
              Managing {NATIONS.find((n) => n.id === nationId)?.name}.
            </div>
          </div>
        )}

        {step === 2 && (
          <StyleStep
            formation={formation}
            approach={approach}
            preference={preference}
            setFormation={setFormation}
            setApproach={setApproach}
            setPreference={setPreference}
          />
        )}
      </div>

      <div style={{ padding: 'var(--pad)' }}>
        <button className="btn btn--primary btn--lg btn--block" disabled={!canNext} onClick={next}>
          {step < 2 ? 'Next' : 'Start Career'}
        </button>
      </div>
    </div>
  )
}

function NationStep({
  selected,
  onSelect,
}: {
  selected: string | null
  onSelect: (id: string) => void
}) {
  // Group by confederation for a scannable, story-flavored pick screen.
  const byConf = new Map<string, typeof NATIONS>()
  for (const n of NATIONS) {
    const arr = byConf.get(n.confederation) ?? []
    arr.push(n)
    byConf.set(n.confederation, arr)
  }
  return (
    <>
      {[...byConf.entries()].map(([conf, nations]) => (
        <div key={conf}>
          <div className="sectionhdr">
            {CONFEDERATION_NAMES[conf as keyof typeof CONFEDERATION_NAMES]}
          </div>
          <div className="nation-grid">
            {nations.map((n) => (
              <button
                key={n.id}
                className={`nation-card ${selected === n.id ? 'on' : ''}`}
                onClick={() => onSelect(n.id)}
              >
                <div className="nation-card__name">{n.name}</div>
                <div className="nation-card__sub">
                  Rating {n.nationRating} · {n.tacticalIdentity}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

function StyleStep(props: {
  formation: string
  approach: Approach
  preference: Pref
  setFormation: (f: string) => void
  setApproach: (a: Approach) => void
  setPreference: (p: Pref) => void
}) {
  return (
    <>
      <div className="card">
        <div className="field-label">Preferred formation</div>
        <div className="chiprow">
          {FORMATIONS.map((f) => (
            <button
              key={f.id}
              className={`chip ${props.formation === f.id ? 'chip--on' : ''}`}
              onClick={() => props.setFormation(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="field-label">Approach</div>
        <div className="segmented">
          {(['Attacking', 'Balanced', 'Defensive'] as Approach[]).map((a) => (
            <button
              key={a}
              className={props.approach === a ? 'on' : ''}
              onClick={() => props.setApproach(a)}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="field-label">Selection bias</div>
        <div className="segmented">
          {(['Youth', 'Balanced', 'Experience'] as Pref[]).map((p) => (
            <button
              key={p}
              className={props.preference === p ? 'on' : ''}
              onClick={() => props.setPreference(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="faint" style={{ marginTop: 10, fontSize: 13 }}>
          Affects who the auto-selector favours. You always have the final say in the squad.
        </div>
      </div>
    </>
  )
}

import { useGame } from '@/state/store'
import { NATIONS_BY_ID, ALL_NATIONS_BY_ID } from '@/data/nations'
import { displayYear } from '@/data/windows'
import { reputationLabel } from '@/engine/manager'

// The Final Whistle: your whole career rendered as a story. Shown when you
// choose to walk away — the payoff of a 40-year save is READING it. Backing
// out costs nothing; starting a new legacy erases the save (the world you
// built lives only in this timeline, which is rather the point).
export function FinalWhistleScreen() {
  const career = useGame((s) => s.career)!
  const go = useGame((s) => s.go)
  const abandonCareer = useGame((s) => s.abandonCareer)
  const beginSuccession = useGame((s) => s.beginSuccession)

  const startNation = career.history.find((h) => h.type === 'JOB')
    ? null // took other jobs along the way
    : NATIONS_BY_ID[career.managerNationId]
  const jobs = [
    ...new Set([
      ...(startNation ? [] : []),
      ...career.history.filter((h) => h.type === 'JOB').map((h) => h.nationId!),
      career.managerNationId,
    ]),
  ]
  const sackings = career.history.filter((h) => h.type === 'SACKED').length
  const wcs = career.trophies.filter((t) => t.kind === 'WORLD_CUP')
  const conts = career.trophies.filter((t) => t.kind === 'CONTINENTAL')
  const potys = career.history.filter((h) => h.type === 'POTY' && h.managerMoment).length
  const rec = career.record
  const winPct = rec.p > 0 ? Math.round((rec.w / rec.p) * 100) : 0
  const years = career.season - career.eraStartSeason + 1

  const epitaph =
    wcs.length >= 2
      ? 'They will name stadiums after you.'
      : wcs.length === 1
        ? 'You touched the sky once. Most never do.'
        : conts.length > 0
          ? 'A continental champion. The almanac remembers.'
          : career.reputation >= 60
            ? 'No silverware — but nobody who watched your teams will forget them.'
            : sackings > 0
              ? 'It was a hard road. You walked all of it.'
              : 'The game gives and the game takes. You gave more.'

  return (
    <div className="screen">
      <div className="topbar">
        <button className="iconbtn" onClick={() => go('legacy')} aria-label="Back">‹</button>
        <div className="topbar__title">The Final Whistle</div>
      </div>

      <div className="screen__body">
        <div className="card center" style={{ padding: 22 }}>
          <div style={{ fontSize: 34 }}>🎬</div>
          <div style={{ fontSize: 21, fontWeight: 900, marginTop: 6 }}>{career.managerName}</div>
          <div className="muted" style={{ fontSize: 13 }}>
            {displayYear(career.eraStartSeason)}–{displayYear(career.season)} · {reputationLabel(career.reputation)}
          </div>
          <div style={{ fontSize: 15, marginTop: 12, fontStyle: 'italic', lineHeight: 1.5 }}>
            “{epitaph}”
          </div>
        </div>

        <div className="card">
          <div className="field-label">The numbers</div>
          <Line k={`${years} season${years === 1 ? '' : 's'} in international football`} />
          <Line k={`${jobs.length} nation${jobs.length === 1 ? '' : 's'} managed — ${jobs.map((id) => ALL_NATIONS_BY_ID[id]?.name ?? id).join(', ')}`} />
          <Line k={`${rec.p} matches: ${rec.w} won, ${rec.d} drawn, ${rec.l} lost (${winPct}%)`} />
          {wcs.length > 0 && <Line k={`🏆 World Cups: ${wcs.map((t) => displayYear(t.season)).join(', ')}`} gold />}
          {conts.length > 0 && <Line k={`🥇 Continental titles: ${conts.map((t) => displayYear(t.season)).join(', ')}`} gold />}
          {potys > 0 && <Line k={`👑 Managed ${potys} World Player of the Year season${potys === 1 ? '' : 's'}`} />}
          {career.legends.length > 0 && <Line k={`🎖️ ${career.legends.length} player${career.legends.length === 1 ? '' : 's'} sent into the Pantheon`} />}
          {sackings > 0 && <Line k={`🪓 Sacked ${sackings} time${sackings === 1 ? '' : 's'} — and never stayed down`} />}
        </div>

        <div className="card">
          <div className="field-label">Moments they'll retell</div>
          {career.history.filter((h) => h.managerMoment).slice(-8).reverse().map((h, i) => (
            <div key={i} style={{ fontSize: 13.5, marginTop: 5, lineHeight: 1.45 }}>
              <span className="muted">{displayYear(h.season)}</span> — {h.text}
            </div>
          ))}
          {career.history.filter((h) => h.managerMoment).length === 0 && (
            <div className="muted" style={{ fontSize: 14 }}>The story was just beginning.</div>
          )}
        </div>
      </div>

      <div style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="btn btn--lg btn--block" onClick={() => go('legacy')}>
          ‹ Not yet — one more cycle
        </button>
        <button
          className="btn btn--lg btn--block"
          onClick={() => {
            if (window.confirm('Retire and hand over? A NEW manager inherits this exact world — the almanac, the eras, the rivals — and your era becomes their history.')) {
              beginSuccession()
            }
          }}
        >
          🔄 Retire & hand over — new manager, same world
        </button>
        <button
          className="btn btn--primary btn--lg btn--block"
          onClick={() => {
            if (window.confirm('Hang it up for good? This retires the save and starts a completely fresh world.')) {
              void abandonCareer()
            }
          }}
        >
          🎬 Retire — start a new legacy
        </button>
      </div>
    </div>
  )
}

function Line({ k, gold }: { k: string; gold?: boolean }) {
  return (
    <div style={{ fontSize: 14, marginTop: 6, fontWeight: gold ? 800 : 400, color: gold ? 'var(--gold, #e7c66a)' : undefined }}>
      {k}
    </div>
  )
}

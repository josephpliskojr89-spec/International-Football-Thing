import type { Player } from '@/engine/types'
import { displayOverall, formColor, positionColor, freshnessColor } from '../display'

export function PlayerRow({ p, onClick }: { p: Player; onClick?: () => void }) {
  return (
    <button className="prow" onClick={onClick}>
      <span className="prow__pos" style={{ background: positionColor(p.position) }}>
        {p.position}
      </span>
      <span className="prow__main">
        <span className="prow__name">{p.name}</span>
        <span className="prow__sub">
          {p.age} · {p.club}
        </span>
      </span>
      <span className="prow__meta">
        <span className="prow__ovr">{displayOverall(p)}</span>
        <span className="prow__dots">
          <i className="dot" style={{ background: formColor(p.form) }} title="form" />
          <i className="dot" style={{ background: freshnessColor(p.freshness) }} title="freshness" />
        </span>
      </span>
    </button>
  )
}

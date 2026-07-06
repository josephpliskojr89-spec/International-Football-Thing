import { useGame } from '@/state/store'
import { ALL_NATIONS_BY_ID } from '@/data/nations'
import { ratingOf, worldRankOf } from '@/engine/world'
import { reputationLabel } from '@/engine/manager'
import { InCareerHeader } from '../components/InCareerHeader'

// The crossroads screen: sacked and choosing your comeback, or courted by a
// giant and weighing loyalty against ambition. The world state travels with
// you either way — this is one career, many chapters.
export function OffersScreen() {
  const career = useGame((s) => s.career)!
  const acceptOffer = useGame((s) => s.acceptOffer)
  const declineOffers = useGame((s) => s.declineOffers)
  const sacked = !!career.sackedFrom

  return (
    <div className="screen">
      <InCareerHeader
        title={sacked ? 'The Next Chapter' : 'An Approach'}
        sub={`Reputation: ${reputationLabel(career.reputation)}`}
      />

      <div className="screen__body">
        <div className="card">
          {sacked ? (
            <>
              <div style={{ fontWeight: 800, fontSize: 16 }}>You've been sacked.</div>
              <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>
                {ALL_NATIONS_BY_ID[career.sackedFrom!]?.name} have moved on. These federations still
                believe in you. Everything you've built — your record, your reputation, the world
                you've shaped — comes with you.
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 800, fontSize: 16 }}>A bigger job wants you.</div>
              <div className="muted" style={{ fontSize: 14, marginTop: 6 }}>
                Take it, and you inherit a stronger squad with heavier expectations. Stay, and the
                fans will remember your loyalty.
              </div>
            </>
          )}
        </div>

        {career.offers.map((id) => {
          const n = ALL_NATIONS_BY_ID[id]
          if (!n) return null
          const rank = worldRankOf(career.world, id)
          return (
            <button
              key={id}
              className="card"
              style={{ textAlign: 'left', width: '100%' }}
              onClick={() => acceptOffer(id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 900, fontSize: 17 }}>{n.name}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {rank > 0 ? `${rank}th in the world` : 'Unranked'} · rating{' '}
                    {Math.round(ratingOf(career.world, id))} · plays {n.tacticalIdentity}
                  </div>
                </div>
                <span className="faint" style={{ fontSize: 20 }}>›</span>
              </div>
            </button>
          )
        })}

        {!sacked && (
          <button className="btn btn--block" onClick={declineOffers}>
            Stay loyal — turn them down
          </button>
        )}
      </div>
    </div>
  )
}

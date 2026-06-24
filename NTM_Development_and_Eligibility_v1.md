# National Team Manager — Player Development & Eligibility

## Bible Section v1.0

---

## Overview

Player development happens at the club, in simulation, **outside the player's direct control** — exactly as it does for a real national team manager. The manager is a *selector and an advisor*, not a coach who runs training. The player observes development through scouting reports and news, and influences it only through two indirect levers:

1. **Who they call up** — caps and tournament minutes carry a small development weight.
2. **Advisory events** — rare, optional, low-bandwidth nudges (e.g. publicly suggesting a player needs a move).

Layered on top is the **eligibility system**: multi-national players carry a hidden preference, can be courted, can say no, and can be permanently locked through a competitive cap. This is the game's small negotiation layer.

These systems are tightly interwoven — a single competitive call-up can both develop a youngster *and* lock his international future — so they are documented together.

---

## Part 1 — The Development Engine (Automated)

Development runs during club simulation. The player sees none of the math — only outcomes (improved ratings, scouting reports, news).

```
Growth = f(Age, Potential, ClubPrestige, PlayingTime, Form)
```

| Factor | Effect |
|--------|--------|
| **Age** | Drives an age curve: rapid growth late teens/early 20s, plateau mid-20s, decline from ~30. Position-dependent — keepers and defenders age slower. |
| **Potential** (hidden) | The ceiling. A player only approaches it under good conditions. |
| **Club Prestige + Development rating** | A wonderkid at a big, well-run club develops fast; the same kid at a low-prestige club stagnates. |
| **Playing Time** | The dominant lever. Star Player / Starter / Rotation / Bench / Reserve. A talented kid not playing is a talented kid not developing. Drives advisory events. |
| **Form** | Minor short-term modifier. |

**Output is invisible math.** The player checks the squad and sees a player has improved; they do not see growth coefficients.

### Call-Up Development Weight (passive lever)
Caps and tournament minutes carry a **small real development value** — international football genuinely accelerates young players. This rewards blooding youngsters in friendlies and low-stakes qualifiers rather than only picking proven veterans.

**Keep the weight low.** Club football must remain the dominant driver — honesty demands it. The international boost is a nudge, never a substitute for club minutes.

---

## Part 2 — Advisory Events (the player's active lever)

A development event triggers when the engine detects a meaningful mismatch — most often a high-potential player with poor playing time. Events surface between or during windows as a quick, optional, single-tap decision (fits the "windows are short" constraint).

### Event Archetypes (keep the pool small for v1)

**1. Wasted Talent** — high potential, low minutes.
> **Wasted Talent?**
> Marco Vieri (19, Potential ★★★★½) has fallen out of favor at Lisbon Club — Reserve minutes only. His development has stalled.
> - **Advise a move** — publicly suggest he needs first-team football.
> - **Stay patient** — say nothing.
> - **Ignore**

**2. The Veteran Question** — aging star declining. Publicly back him or signal it's time? Affects retirement timing and morale.

**3. Loyalty Tug** — a dual-national wonderkid is wavering. Bridges directly into the Eligibility system (Part 3).

**4. Burnout Risk** — an overplayed young star is injury-prone this cycle. Rest him from the next window for long-term benefit vs. need him now.

### Why advice is a real decision, not a free buff
**The manager cannot transfer the player.** "Advise a move" only raises the *probability* that the club sim engineers a transfer to a better situation next window. It carries risk:

- The move might not happen (the club digs in).
- The advice might leak and sour the player or his current club.
- He might move somewhere worse.

You are spending a small amount of influence on a probabilistic outcome — exactly what real national managers do when they tell the press a player "needs to be playing every week."

---

## Part 3 — Eligibility & Persuasion (the negotiation layer)

### The hidden preference (lean)
Every multi-national carries a concealed **lean** toward each nation he's eligible for — a weighting, not a binary. The player never sees the numbers; they infer them through interest and response.

Lean is seeded at generation from honest inputs:

- **Where raised / born** — a kid raised in Germany leans Germany.
- **Club country** — playing his football somewhere warms him to it.
- **Heritage strength** — connection to the "second" nation (American grandparent vs. American parent he grew up with).
- **Family / personal flavor** — a hidden tiebreaker producing occasional surprises.

### The three eligibility states

| State | Meaning | How reached |
|-------|---------|-------------|
| **Eligible** | Could play for you, not committed | Default for a dual-national |
| **Provisionally tied** | Played a *friendly* for you — leaning your way, still pryable | Friendly call-up |
| **Cap-tied** | Locked permanently | Played a *competitive* match (qualifier/tournament) |

**Real-world rule modeled:** friendlies do not lock a player; a competitive senior cap does. This gradient of commitment is the core of the mechanic.

### The probe — learning the lean
The player can't see the lean but can *test* it. Expressing interest both reveals information and moves the needle:

| Action | Reveals | Effect on lean |
|--------|---------|----------------|
| **Scout / monitor** | Vague signal ("seems open" / "committed elsewhere") | None |
| **Informal contact** | Clearer read on interest | Small positive nudge |
| **Friendly call-up** | Strong read — does he accept? | Moderate positive nudge |
| **Competitive call-up** | Definitive — acceptance locks him forever | Largest nudge (if accepted) |

### He can say no
A call-up is an **ask, not an order.** Acceptance is a probability check against his current lean toward you:

- **Strong lean your way** → accepts readily.
- **Genuinely torn** → may accept, may decline, or may **ask for time to consider**.
- **Leaning rival** → likely declines. A public rejection costs a little standing and warns the rival you're circling.

A decline isn't the end — courting can continue — but each rejected approach makes the next harder and signals urgency to competitors.

### The "asks for time" state
Where the drama lives. A torn player responds with **"considering"** rather than yes/no. This:

- Opens a window for the rival nation to make its own approach (flagged by the news system: *"Germany have reportedly made contact with..."*).
- Forces the player's next decision: push harder (risk a no) or give space (risk the rival closing).
- Resolves after a window or two.

### The rival-nation clock
Other eligible nations are **active AI competitors**, which makes the timing urgent rather than theoretical:

- Each dual-national has a hidden lean toward *every* eligible nation, nudged by upbringing, club, form, and who has shown interest.
- Rival nations cap-tie on their own schedule. The news system surfaces the threat: *"Reports suggest France are monitoring Alejandro Ruiz ahead of next month's qualifiers."*
- Dawdle and you get the gut-punch: *"Alejandro Ruiz cap-tied to France."* Gone forever — and it should be entirely the player's fault for waiting.

### The American-manager playbook (emergent, not scripted)
The real-world pattern of US managers flipping German-raised kids falls out of the system naturally:

- A kid leaning Germany but US-eligible starts with a lean against you.
- You can't override Germany's wishes — but you can **invest early**: informal contact at 17, a friendly call-up at 18 to make him feel wanted, persistent interest that nudges the lean while Germany (deeper pool) hasn't prioritized him.
- The window is the gap between your urgency and the rival's complacency. A nation that produces midfielders in bulk won't prioritize this kid — that's the opening.

Nothing here is scripted; it emerges from lean values, pool depth, and rival AI attention.

---

## Part 4 — The Development + Eligibility Synergy

The competitive cap does **double duty**: it locks the player *and* grants the international-minutes development boost. So "lock him in early" is not purely defensive — it's also an early investment in his growth.

This produces an emergent **national philosophy** for free:

- A nation that aggressively caps young dual-nationals builds a slightly better long-term talent pool — but risks burning competitive minutes on unproven kids.
- A patient nation keeps its competitive squad strong now but risks losing wonderkids to rivals.

The player leans into one identity or the other through accumulated choices, with no system explicitly offering it.

---

## The Combined Eligibility Event (worked example)

This is the **Loyalty Tug** archetype fully realized:

> **The Ruiz Decision**
> Alejandro Ruiz (18, Potential ★★★★★) is eligible for your nation and Mexico. Mexico are reportedly preparing a competitive call-up. He is raw — not yet at the level of your current options.
>
> - **Cap-tie him now** — name him in a competitive squad. Locks him permanently; he may struggle, and you spend a competitive slot on an unproven teenager.
> - **Friendly call-up** — test him, warm him to the cause, leave the door open. Some development value, no lock.
> - **Monitor** — keep developing him, accept the risk Mexico get there first.

The safest *footballing* choice (wait until proven) is the riskiest *eligibility* choice (he might be poached). That squeeze is the entire point.

---

## Scope Discipline

- **Dual-national cases stay rare** — "a few major cases annually" (per core bible). Scarcity is what makes the gut-punch headline land. A constant trickle drains the mechanic of weight.
- **Mechanical surface stays small:** a hidden lean per eligible nation, four probe actions, three response states (accept / consider / decline), rival AI that probes on its own clock. The richness comes from simple pieces colliding over time.
- **No contract talks, agents, or haggling.** Just interest, response, and a closing window. Honest to how it actually works, and every interaction is a single tap.

---

## The Player's Complete Development Toolkit

| Lever | What it does | Permanence |
|-------|-------------|------------|
| **Call up (friendly)** | Small development boost; warms a dual-national; provisional tie | Reversible |
| **Call up (competitive)** | Development boost; **permanently cap-ties** | Permanent |
| **Advise a move** | Raises probability of a beneficial transfer; carries leak/backfire risk | Probabilistic |
| **Probe / court** | Reveals hidden lean; nudges it toward you | Cumulative |
| **Do nothing** | Let club football develop him; accept eligibility risk | — |

The manager never runs a training session he wouldn't actually run. Every lever is honest to the real role: **select, advise, court, and live with the outcomes.**

---

## Implementation Notes for Claude Code

- The development engine runs during club simulation as a batch pass over all players; expose growth factor weights as named constants for tuning.
- Hidden values (Potential, lean per nation, Injury Risk) live on the player object and are never surfaced directly — only through scouting text and outcomes.
- Eligibility state is a per-player enum (`ELIGIBLE` / `PROVISIONAL` / `CAP_TIED`) plus a `tiedNation` field. A competitive cap sets `CAP_TIED` irreversibly — guard this transition carefully.
- Rival-nation courting is an AI pass that runs each window: for each notable dual-national, eligible AI nations probe/cap-tie based on their own needs, the player's lean, and pool depth.
- Advisory and eligibility events are generated by a detector that scans for trigger conditions (high potential + low minutes; aging star in decline; dual-national under rival threat; overplayed youngster) and emits at most a small number per window to avoid spam.
- Keep all event resolution probabilistic and surface results through the news system.

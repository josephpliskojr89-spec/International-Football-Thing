# National Team Manager — Tournament Structure & International Calendar

## Bible Section v1.0

---

## Overview

The game uses **real-world tournament structures** (battle-tested, instantly familiar) with **all trademarked names stripped and replaced by generic confederation labels**. No UEFA, CONMEBOL, FIFA, Euro, or Copa América. Players understand the formats intuitively; there is zero IP exposure.

The international calendar runs on **windows** — designated breaks when clubs release players. Outside windows, nothing happens (players are at clubs, developing). Windows are competitive (fixed fixtures), friendly (manager-scheduled), or tournament blocks (summer).

Match resolution is **three-tiered** so detail follows relevance: the manager's nation is played in full; other playable nations are fully simulated with viewable stats; non-playable filler nations resolve as bare scorelines.

---

## Part 1 — Confederations (Generic Names)

| Real-world analog | Generic name | Playable nations |
|---|---|---|
| UEFA | **European Football Union (EFU)** | England, France, Spain, Germany, Italy, Portugal, Netherlands, Belgium, Croatia, Serbia |
| CONMEBOL | **South American Confederation (SAC)** | Brazil, Argentina, Uruguay, Colombia |
| CONCACAF | **North & Central Confederation (NCC)** | United States, Mexico |
| CAF | **African Football Union (AFU)** | Morocco, Nigeria, Senegal, Ghana, Cameroon |
| AFC | **Asian Football Confederation (ASC)** | Japan, South Korea, Australia |
| OFC | **Oceania Football Union (OFU)** | New Zealand |

**Tournaments:**
- Global: **World Cup** ("World Cup" is a generic descriptor and safe; the protected mark is "FIFA World Cup").
- Continental: **[Confederation] Championship** (e.g. "European Championship," "African Championship"). Generic descriptors — never "Euro" or "Copa."

---

## Part 2 — The Four-Year Cycle

| Year in cycle | Activity |
|---|---|
| **Year 1** | Continental Championship (summer) + World Cup qualifying begins |
| **Year 2** | World Cup qualifying continues |
| **Year 3** | World Cup qualifying concludes |
| **Year 4** | **World Cup** (summer) |

Mirrors the real even-year-tournament / odd-year-qualifying pulse. Every cycle delivers two summer payoffs (a continental and a World Cup) plus two years of qualifying grind.

---

## Part 3 — Qualification Formats (per confederation)

Use the real-world structures — they vary meaningfully by confederation, giving each region a distinct feel. Managing the USA through the NCC should feel nothing like grinding Uruguay through the SAC.

- **EFU (Europe):** Group stage → group winners qualify, runners-up to playoffs. Many nations; moderate difficulty for the strong.
- **SAC (South America):** Single round-robin league table — everyone plays everyone home and away, top N qualify. Brutal "league of death," no easy games.
- **NCC (North/Central):** Multi-round, with strong nations seeded into a final group ("Hex"-style final round). Easier path for US/Mexico, dramatic for the rest.
- **AFU (Africa):** Group stages narrowing to a final qualifying round.
- **ASC (Asia):** Multiple group rounds, progressively narrowing.
- **OFU (Oceania):** Tiny — short tournament, often a single slot or an inter-confederation playoff. (This is why New Zealand has "easier qualification" in the core bible — it's real.)

### Inter-Confederation Playoffs
The final few World Cup spots come from playoffs *between* confederations (e.g. an OFU side vs. an ASC side). This is the lifeline that lets a small nation sneak in and generates excellent underdog stories. Low cost, high drama. **Included in v1.**

---

## Part 4 — The International Calendar & Friendlies

### Window Types

| Window | Contents |
|---|---|
| **Competitive** | Qualifiers or tournament matches — fixed by the calendar; opponents not chosen |
| **Friendly** | Open slots the manager fills |
| **Tournament (summer)** | Continental Championship or World Cup — a block of matches |

### Friendly Scheduling — a real decision
In a friendly window the manager chooses opponents. Axes of decision:

- **Opponent strength** — strong nation tests you and earns ranking points (risky); weak nation builds morale and bloods youngsters safely (low risk, low reward).
- **Style matchup** — book a friendly against a nation that plays like an upcoming qualifying opponent to prepare tactics.
- **Youngster showcase** — friendlies don't cap-tie, so this is the risk-free tool to test prospects and *warm* dual-nationals without locking them (direct tie-in to the Eligibility system).

### What friendlies do (each value distinct, so scheduling isn't busywork)

1. **Ranking points** — beating strong nations raises world ranking, affecting tournament seeding (real mechanic — friendlies count toward rankings).
2. **Player development** — the small international-minutes boost, especially valuable for youngsters.
3. **Match sharpness & chemistry** — maintains squad cohesion/fitness between competitive windows.
4. **Eligibility courting** — the friendly call-up that warms a dual-national without locking him.
5. **Tactical experimentation** — low-stakes trial of a formation or style before it matters.

### The scheduling tension
A strong opponent risks morale and exposes weaknesses but earns ranking and battle-tests you; a weak opponent is safe but teaches little and earns few points. A manager chasing a better World Cup seed books tough friendlies; one protecting a fragile young squad books soft ones. Real trade-off, single tap to execute.

### Friendly availability (bounded)
- Each friendly window offers **1–2 slots**.
- Opponent availability is gated: you can only book nations that are themselves free and willing. A top side may decline a friendly against a minnow.
- This prevents farming weak friendlies endlessly and keeps the calendar honest.

---

## Part 5 — Three-Tier Match Resolution

Detail follows relevance. The tier is determined per-match.

| Tier | Who | Resolution | Player sees |
|---|---|---|---|
| **1 — Played** | The manager's own nation | Full match engine; manager picks XI/formation/tactics | Live result, full stats, events, ratings |
| **2 — Simmed (detailed)** | Other **playable** nations (have real squads) | Full match engine runs automatically (AI picks the side) | Final score **+ detailed stats** — scorers, key performers, box-score read |
| **3 — Simmed (scoreline)** | **Non-playable** nations (ratings only, no squad) | Lightweight Poisson resolution from Nation Rating | **Just the score** |

### The resolution rule

```
if manager's nation is playing       → Tier 1 (played)
else if either side is a playable nation → Tier 2 (full sim, stats shown)
else                                  → Tier 3 (scoreline only)
```

### Worked example (NCC)
Managing the **USA**:
- **USA vs. anyone** → Tier 1. You pick the team and play it.
- **Mexico vs. Costa Rica** → Tier 2. Mexico is playable, so the full engine simulates it (AI manages Mexico) and you can pull detailed stats — useful scouting before you face them.
- **Panama vs. Jamaica** → Tier 3. Both non-playable filler; resolves as `2–1`, nothing more.

### The multi-playable-group wrinkle (handled by the rule)
In the EFU a group may contain several playable nations. Managing **Spain** with **Italy** in the group:
- **Spain vs. Italy** → Tier 1 (you play it).
- **Italy vs. [other]** → Tier 2 (full sim, stats viewable).

No special handling — the rule above resolves it automatically.

### Tier 3 lightweight resolution
Non-playable nations carry the three ratings from the core bible (**Nation Rating, Youth Rating, Tactical Identity**) — no squad is ever generated. Tier 3 therefore does **not** run the six-step engine:

```
StrengthA = NationRating_A × HomeBonus × small_variance
StrengthB = NationRating_B × small_variance
ScoreA ~ Poisson(scaled from StrengthA vs StrengthB)
ScoreB ~ Poisson(scaled from StrengthB vs StrengthA)
```

- Uses the **same Poisson backbone** as the real engine, so Tier 3 scorelines feel consistent with the rest of the world.
- **Tactical Identity** can flavor the result (a defensive nation trends toward lower scores).
- A fraction of the computational cost of the full engine. The zone/formation/matchup machinery runs only for Tiers 1 and 2.

### Why this tiering is right
- **The qualifying table stays alive** — you can scout a playable rival's form in detail before facing them (Tier 2).
- **The filler stays invisible** — you never inspect Panama's box score, and the game never makes you.
- **Tier 2 feeds news and rivalries for free** — "Mexico thrash Costa Rica 4-0" is a generated headline straight out of the Tier-2 sim.

---

## Implementation Notes for Claude Code

- The calendar is the master loop: advance window to window, each window carrying a type (competitive / friendly / tournament) and a fixture list.
- Resolve each fixture by tier using the rule in Part 5. Batch Tier 3 fixtures — they're cheap and numerous.
- Qualifying simulation is **player-centric**: the manager's matches are played (Tier 1), all other fixtures are simmed (Tier 2 or 3) and surfaced as table updates.
- Each confederation needs a format definition (group structure, number of qualifiers, playoff rules) as data, not hardcoded logic, so formats can be tuned.
- Friendly scheduling: present available willing opponents for the open slot(s); willingness gated by relative strength and the opponents' own calendar.
- Ranking is a running value updated by all results (competitive weighted higher than friendly); it drives tournament seeding.
- Inter-confederation playoffs slot in after confederation qualifying concludes (Year 3), feeding the final World Cup places.

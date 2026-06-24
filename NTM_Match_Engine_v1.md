# National Team Manager — Match Engine

## Bible Section v1.0

---

## Overview

The match engine resolves a single match in one computational pass — no minute-by-minute simulation. It computes a strength value for each team across three zones, applies modifiers, models tactical matchups, generates expected goals, and resolves the final score using a Poisson distribution. Narrative events are back-filled after resolution for the news and ratings systems.

**Design goals:**

- Resolves instantly (pure arithmetic, no live sim)
- Player decisions (formation, style, squad selection, form management) measurably affect outcomes
- Upsets emerge organically from honest modifiers — never forced by special-case code
- Every variance lever is a single tunable constant

**Variance philosophy: "a hair wider than tight."** Over a full campaign the better team wins comfortably and rankings stay meaningful, but any single match carries real upset potential. Cape Verde can draw Spain; Germany can beat Curacao 7-1. Both must be possible on any given day.

---

## Step 1 — Compute Zone Strength

Each team is divided into three zones. Goalkeeping rides with Defense.

| Zone | Primary Ratings | Players Counted |
|------|----------------|-----------------|
| Attack | Finishing, Pace, Technique | Forwards + attacking midfielders |
| Midfield | Passing, Technique, Physical, Mental | All midfielders |
| Defense | Defending, Physical, Goalkeeping | Defenders + goalkeeper |

For each zone, compute a weighted average of the relevant ratings across the players the chosen **formation** places in that zone.

**Critical design point:** the formation is not a bonus table. The formation determines *which players land in which zone and how many*. A 4-3-3 places three players in Midfield and three in Attack; a 5-3-2 places five in Defense. Zone strengths therefore shift naturally from formation choice — the tactical effect is emergent, not hand-coded.

```
ZoneStrength_base = weighted_average(player ratings for that zone)
```

Scale: 1–100, matching player ratings.

---

## Step 2 — Apply Modifiers

Each zone's base strength is adjusted:

```
ZoneStrength_final = ZoneStrength_base
                   × FormMultiplier
                   × StyleModifier
                   × HomeBonus
```

### Form Multiplier
Average the form values of the players in the zone, mapped to a multiplier.

- **Range: 0.92 – 1.10** (slightly top-weighted)
- The upside (1.10) is intentionally larger than the downside (0.92): "team catches fire" is a more satisfying upset story than "team collapses," and a minnow's good day should feel earned.

### Style Modifier
The team's tactical style applies a small +/- nudge per zone and feeds the matchup interactions in Step 3. (Style options: Balanced, Possession, Counter Attack, Direct, High Press.)

### Home Bonus
- **Flat multiplier: 1.03** to all zones for the home side.
- Deliberately small. Stacks multiplicatively with form and style, which is how organic upsets arise (see Step 7).

---

## Step 3 — Zone Matchups

Compare zones across the two teams. This is what makes formations feel tactical without a possession simulator.

- **Midfield vs. Midfield** → the winner controls territory and receives a small `MidfieldEdge` boost that feeds into chance generation. Midfield is the fulcrum.
- **Attack vs. opponent Defense** → determines your chance quality.
- **opponent Attack vs. your Defense** → determines their chance quality.

A 4-3-3 winning the midfield battle against a 4-4-2 means its attack operates with an edge — territorial advantage modeled without simulating possession.

```
MidfieldEdge = function(MyMidfield_final / TheirMidfield_final)
```

Keep `MidfieldEdge` in a modest band (e.g. ~0.85–1.15) so midfield matters without dominating.

---

## Step 4 — Generate Expected Goals (xG)

Convert the attack-vs-defense deltas into an xG figure per side:

```
xG = BaseChances
   × (AttackStrength_final / OpponentDefenseStrength_final)
   × MidfieldEdge
```

- **`BaseChances`** is tuned so a balanced match produces **~1.3 xG per side** (realistic international scoring).
- A dominant side might generate 2.5+ xG; an outmatched side as low as the floor below.

### xG Floor (guardrail)
Apply a **minimum of 0.3 xG per side**, regardless of mismatch. Even in a 90-vs-50 blowout, the weaker side keeps a puncher's chance. Without this floor, lopsided matches zero out the underdog and you lose the "anyone can score on their day" magic. One clamp, large payoff.

```
xG = max(xG, 0.3)
```

---

## Step 5 — Resolve the Score

Draw each side's goal count from an **independent Poisson distribution** seeded by that side's xG.

```
GoalsHome ~ Poisson(xG_home)
GoalsAway ~ Poisson(xG_away)
```

Poisson is the standard, proven model for football scorelines. It naturally produces 0-0 draws, 1-0 grinds, and occasional 4-1 thrashings at realistic frequencies. Because football is low-scoring, Poisson is inherently swingy — even a 2.2-xG side fails to beat a 0.6-xG side roughly 12–15% of the time, purely from the distribution. This protects the underdog for free, so the form range does not need to be cranked.

---

## Step 6 — Back-Fill Narrative Events

After the score is resolved, generate flavor events for the news and ratings systems. **These do not affect the result.**

- **Goalscorers** — assign each goal to a likely scorer, weighted by Finishing + Form among the attacking players on the field.
- **Injuries** — roll per player, weighted by the hidden Injury Risk rating.
- **Man of the Match** — assign based on contribution (scorers, defensive performance in a clean sheet, midfield matchup winner).
- **Ratings** — generate per-player match ratings feeding morale and development.

---

## Step 7 — Worked Example: The Cape Verde Moment

A ~55-rated underdog at home, running hot, against a ~75-rated favorite having an off day:

```
Underdog Attack: base × 1.10 (form) × 1.03 (home) = ×1.13
Favorite zones:  base × 0.94 (cold form)
```

Nothing forces this result. The home bonus, a hot form roll, and a cold form roll for the favorite collide, the xG gap narrows, and Poisson does the rest. The upset emerges from honest modifiers — exactly the design intent.

---

## Final Tuning Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| Form range | 0.92 – 1.10 | Per-match wildcard, top-weighted |
| Home bonus | 1.03 | Small home-field edge |
| xG floor | 0.3 per side | Underdog's puncher's chance |
| Base xG (balanced match) | ~1.3 per side | Realistic scoring rate |
| MidfieldEdge band | ~0.85 – 1.15 | Midfield matters, doesn't dominate |
| Resolution | Independent Poisson per side | Proven scoreline model |

### Expected outcome distribution
For a lopsided match (~75-rated vs. ~55-rated nation):

| Outcome | Approx. Frequency |
|---------|-------------------|
| Favorite wins | ~62% |
| Draw | ~24% |
| Underdog wins | ~14% |

Over a six-game qualifying group the favorite tops the table most of the time, but dropped points on a bad away day happen often enough to brace for every window.

---

## Implementation Notes for Claude Code

- All six computational steps are arithmetic; no loops over match minutes.
- Every variance lever is a single named constant — expose them for playtesting.
- Keep the engine pure: inputs are (squad, formation, style, home/away, opponent); output is (score, events list). No side effects on global state — let the calling layer apply morale/development/ranking changes from the returned events.
- Seed the RNG per match so results are reproducible during debugging.

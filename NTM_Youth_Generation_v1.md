# National Team Manager — Youth Generation

## Bible Section v1.0

---

## Overview

Youth Generation is the **source of the pipeline** — the system that makes the game renewable. Every wonderkid you chase, every dual-national tug-of-war, every golden generation that wins you a World Cup originates here. Once per year, each nation produces a youth intake: a class of new prospects entering the world.

Two principles define the system:

1. **Silent generation** — new prospects enter the world quietly. The player is *not* handed a list. You discover talent through the news feed and scouting, exactly as the discovery tension in those systems intends. A 16-year-old isn't famous; you find out he's special by watching, or by his hype forcing its way into the feed.
2. **Volume scales with the nation's pool** — big football nations generate *more bodies*, not merely better ones. Population controls intake size, which controls how many lottery draws a nation takes against the potential distribution.

---

## Part 1 — The Two-Stage Generation Formula

Generation is two distinct stages. The original bible's three inputs (Youth Rating, Population, Football Culture) map onto them cleanly:

```
Stage 1 — Intake SIZE      = f(Population / pool depth)
                             → how many prospects this nation produces this year

Stage 2 — Each prospect's POTENTIAL = a draw from a distribution
                             shaped by YouthRating  (shifts the curve up/down)
                             floored by FootballCulture (trims the bottom)
```

**Population drives how many rolls. Youth Rating and Culture shape what each roll can produce.** This separation is what lets a nation be big-but-mediocre (high volume, low hit rate) or small-but-elite (few players, high hit rate) — and every combination in between yields a distinct national character for free.

---

## Part 2 — Intake Size Scales With Pool (Population)

Intake size is **not** a flat 5–10 for everyone. It scales with the nation's footballing pool depth:

| Tier | Examples | Annual class | Effect |
|---|---|---|---|
| **Major producers** | England, Brazil, France, Germany, Spain | Large class | Many draws → useful players most years, gems appear regularly |
| **Mid-tier** | Uruguay, Serbia, Senegal | Moderate class | Fewer draws → quality (culture floor) matters more than volume |
| **Minnows** | New Zealand | Small class | Few draws → gems are genuinely rare; one wonderkid is a national story |

### Why this compounds with the lottery
It's not only that a big nation's players are individually more likely to be good — it's that the nation takes **so many more draws** from the distribution that its long, thin tail of brilliance gets sampled far more often. Brazil produces a wonderkid most cycles by sheer volume of rolls against a high-quality curve; New Zealand might wait a generation for one.

### Why this strengthens the underdog story
When a thin-pool nation *does* produce a genuine star, it is mathematically special — the system made it rare. The news hype and the "lock this kid down before he's poached" tension feel earned. **Eligibility stakes are highest exactly where the pool is thinnest.**

---

## Part 3 — The Potential Distribution (where the magic lives)

The shape of the potential distribution is what makes most classes forgettable and rare classes electric. Use a heavily **right-skewed distribution** — lots of ordinary, a long thin tail of brilliance:

- **Most prospects:** low-to-mid potential. Squad filler or never make it. **This is correct and important** — if every kid were a star, no kid would feel special.
- **Occasional:** genuinely good prospects — future starters.
- **Rare:** the wonderkid. Generational potential the news feed hypes and the player chases.

How the dials reshape the curve:
- **Youth Rating** shifts the whole curve up or down (a youth powerhouse's ordinary kid is better than a weak nation's ordinary kid).
- **Football Culture** trims the bottom — a strong culture raises the floor, so even average prospects come out more polished and professional.
- **Population** doesn't reshape the curve; it adds more draws from it (Part 2).

---

## Part 4 — What a Generated Prospect Looks Like

Each prospect is born with:

- **Current ratings** — low (they're teenagers); the visible starting point.
- **Potential** (hidden) — the ceiling; the lottery outcome that matters.
- **Hidden traits** — Professionalism, Consistency, Injury Risk (from the player model).
- **A starting club** — assigned by plausibility (better prospects more likely to start at, or quickly reach, higher-prestige clubs via the transfer sim).
- **Position, age (~16–18), nationality.**
- **Any dual-national eligibility** (see Part 6).

---

## Part 5 — Golden Generations (the rare event)

The core bible wants "golden generation arrives" as a news beat. This is a **deliberate rare modifier**, not just luck stacking:

- Occasionally (low annual probability, weighted by Youth Rating), a nation's intake receives a **golden-generation flag** — that year's class is seeded with multiple high-potential prospects at once.
- **Effect:** a cluster of elite talent of roughly the same age who will peak together ~8–10 years later — the setup for a dominant tournament run, and the bittersweet decline when they age out together.
- **Story value:** creates long-term arcs. You spot the golden generation emerging, nurture them through a cycle or two, and chase the title while their window is open. Huge fuel for the news feed and for player attachment.

---

## Part 6 — Dual-Nationality Seeding

Youth generation is where eligibility is **born** — the spawn point for every future "Ruiz decision."

- A **small fraction** of each intake is generated as dual-national: eligible for the producing nation plus one other.
- The second eligibility is weighted by plausible migration/heritage patterns (e.g. the US drawing German- and Mexican-eligible kids).
- Keep the fraction **small**, per the eligibility section's scarcity rule — rare cases are what make the tug-of-war land.

---

## Part 7 — The Reveal (ties back to scouting)

A prospect is *generated* with hidden potential, but the player **does not see it accurately until scouted** — consistent with silent generation:

- A new intake exists in the world as **fuzzy reads** (or unknown entirely until they surface).
- The news feed hypes the ones flashing early promise.
- The player spends **targeted looks** to separate real gems from flat-track bullies.

Youth generation produces the raw material; **scouting is how you discover what you've got.** The two systems lock together: generation hides the truth, scouting reveals it.

---

## Scope Discipline

- **Intake size scales with pool**, but stays bounded — even major producers generate a sane, finite class each year.
- **Prospects are only fully fleshed out when they matter.** A non-playable nation's intake can stay lightweight until one of its kids becomes dual-national-relevant or a transfer target — consistent with the core bible's "players generated only when needed."
- **No youth academies, no youth coaching, no youth tournaments.** Generation is an annual event, not a managed system — honest to the national-manager role, who runs youth development no more than he runs club development.

---

## Implementation Notes for Claude Code

- Youth generation runs **once per year** as a batch pass over all nations.
- **Stage 1:** compute intake size from the nation's pool/population tier — a count, not a fixed constant. Major producers get larger counts; minnows get small ones.
- **Stage 2:** for each prospect, draw potential from a right-skewed distribution; shift the distribution by Youth Rating, raise its floor by Football Culture.
- Roll the **golden-generation flag** per nation per year at low probability (weighted by Youth Rating); if set, seed several high-potential prospects into that class.
- Roll **dual-national eligibility** on a small fraction of prospects; assign the second nation by a weighted heritage/migration table.
- New prospects enter **silently** — no automatic notification to the player. They become visible only via news hype (driven by club performance/development) or via scouting coverage of their league.
- Generated potential is **hidden**; the player's view is governed entirely by the scouting freshness model. Never surface true potential directly on a fresh intake.
- For non-playable nations, defer full prospect detail until a prospect becomes relevant (dual-national to a playable nation, or a transfer/scouting target) — generate lightweight until then.

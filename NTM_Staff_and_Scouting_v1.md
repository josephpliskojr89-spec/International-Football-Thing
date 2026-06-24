# National Team Manager — Staff & Scouting

## Bible Section v1.0

---

## Overview

Scouting is reframed from the original bible's region-resource-allocation model into something truer to the national-manager fantasy: **you don't run a global scout network, you station a small staff across leagues to keep your player pool in view.** A national manager's real scouting problem is information freshness — his players are scattered across the world's leagues, developing at clubs he doesn't control, and he can only watch so many places at once.

The entire system is one decision repeated: **where do I point my coverage so I keep the most of my actual players current?**

> **Scope correction:** the original core bible listed "No staff hiring" and "No staff attributes" as out of scope. That was an over-trim. Staff **are** in by design. Their **only** function is scouting coverage — they do not train players, affect tactics, carry morale, or touch any other system. This tight, single-purpose role is what keeps staff from becoming a management subsystem.

---

## Part 1 — The Staff

- The manager has a small scouting staff: an assistant coach plus scouts, **capped at a small number** (~3–4 total) to stay bounded and mobile-friendly.
- **Their only function is scouting coverage.** No other system references them.
- **No scout skill/quality axis.** A coach assigned to a league simply covers it. There is no "this scout reads more sharply than that one." Coverage is binary: a league is either covered or it isn't.

Staff size may be fixed at game start or gated by manager reputation (see Open Items). Either way, the *game* of scouting is **where you assign them**, not who they are.

---

## Part 2 — Standing League Assignments (the core mechanic)

Each coach receives a **standing assignment to one league.** While assigned:

- They keep **current, sharp reads** on every player **in your pool** who plays in that league.
- The assignment **persists** until you change it — set it and forget it until your needs shift.

Example:
- Coach A → English first division → all your England-based players stay current.
- Coach B → American first division → all your MLS-based players stay current.
- Your three players in the German league → **uncovered** → their reads drift fuzzy.

---

## Part 3 — Coverage Is the Whole Game

Your player pool is scattered across many leagues. You have **fewer coaches than leagues holding your players.** So scouting is a coverage-allocation puzzle:

- **Concentrate for efficiency** — station coaches where your players cluster, maximizing players-covered-per-coach.
- **Accept blind spots** — a league holding only one or two of your players may not justify a coach. Those players go fuzzy; you accept it or spend a targeted look (Part 4).
- **React to movement** — the automated transfer sim can move a player *out* of a covered league. He silently drops off your radar until you notice his read going stale and reassign. This is honest, emergent, and requires no special code.

The optimization goal, stated plainly: **cover as much of your player pool as possible with the coaches you have.**

---

## Part 4 — Targeted Scouting (the flex slot)

On top of standing coverage, each coach can perform **one targeted look per inter-window period** — a specific player or match **outside** their league assignment.

- **Limit: one targeted scout per coach, between windows.**
- A coach does his standing league coverage **plus** up to one off-assignment look if directed.

This is the lever for chasing **news-feed leads**: a wonderkid is hyped in a league you don't cover, so you spend a coach's one targeted look to verify him — **without permanently pulling that coach off his league.**

The two layers together cover both jobs:
- **Standing assignment** → keep your *known pool* current.
- **Targeted look** → chase *new leads* and verify one-offs (hyped prospects, dual-nationals, a player who just transferred away).

---

## Part 5 — Fuzzy Ratings (coverage determines freshness for everyone)

A player's rating is only as current as your coverage of him. This applies to the **entire pool**, not just prospects.

| Coverage state | What you see |
|---|---|
| **Covered** (in an assigned league, or recently targeted) | Sharp, current, accurate rating and potential read |
| **Uncovered, recently seen** | Reasonably current but beginning to drift |
| **Uncovered, long unseen** | Fuzzy — a stale estimate that may no longer reflect his real, club-developed ability |

**Key rule:** *anyone* in an uncovered league drifts fuzzy over time — even an established starter. Your veteran striker in an uncovered league gets stale reads exactly as a prospect would. This makes coverage matter for your whole pool, not merely discovery.

This ties directly to the development engine: a player's **real** rating climbs (or stalls) at his club invisibly. **Your knowledge of it is only as fresh as your last coverage.** Skip coverage of a league for a season and a player there might have leapt ahead — or declined — without your knowing. That gap is the entire tension of scouting.

---

## Part 6 — The Coverage Loop

1. **Assign each coach to a league** (standing; persists until changed).
2. Between windows, covered leagues' pool players keep **current, sharp reads** automatically.
3. **Optionally** spend each coach's **one targeted look** on an off-assignment player/match (a news-feed lead, a dual-national to verify, a player who just transferred away).
4. Players in **uncovered** leagues drift **fuzzy** over time — you're partially blind on them.
5. You make **call-up / courting / selection** decisions on whatever you've kept current.

---

## Part 7 — How Scouting Connects the Systems

Scouting is the **connective tissue** linking observation to action:

- **Development engine** moves real ratings (invisibly).
- **News feed** flags who's moving — the leads.
- **Coverage (standing + targeted)** converts movement into knowledge — the scouting act.
- **Eligibility & call-ups** are the decisions made *with* that knowledge.

Scouting is not a standalone subsystem; it's the verb that turns the news feed into informed selection.

---

## Open Items (to settle before or during build)

**Staff size / hiring currency.** Staff size can be:
- **Fixed** at game start (simplest; no economy), or
- **Reputation-gated** — success expands your staff or attracts more coaches (no money; staff capacity scales with achievement). Recommended if a progression arc is wanted, since it avoids introducing finances.

The "how many coaches" lever is deliberately light; the design intent is that **assignment**, not acquisition, is where the decisions live.

---

## Implementation Notes for Claude Code

- Each player carries a **rating-freshness / confidence** value that decays over time when he is not covered, and resets to sharp when covered (standing or targeted).
- A coach is a lightweight object: an ID and a current **league assignment** (or null). No attributes, no quality value.
- Coverage resolution each period: for every player, check whether his current league is assigned to a coach; if so, refresh his read. Apply targeted looks as one-off refreshes outside assignment.
- The displayed rating is the player's **last known read**, not his real value. The real value lives hidden on the player and is updated by the development engine; the read only syncs to it on coverage.
- Targeted look is a per-coach, per-inter-window-period flag — enforce the one-per-coach limit.
- When the transfer sim moves a player between leagues, do **not** auto-refresh his read — let coverage status (and therefore freshness) change naturally so the player must notice and react.
- Surface scouting leads through the news feed; the news system is the scouting interface, not a separate browsable database.

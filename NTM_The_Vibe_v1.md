# National Team Manager — The Vibe

## Design Feel & Experiential Identity (standalone)

---

## What This Document Is

The six system bibles describe **what to build.** This document describes **what it should feel like to hold.** When an implementation decision is mechanically ambiguous, this is the tiebreaker. The feel is not decoration layered on at the end — it is a design constraint with veto power, equal in weight to the systems.

**One sentence:** A colorful, fast, mobile-first international management game that you understand in five minutes and are still mastering a year later.

---

## The North Star: Easy to Learn, Hard to Master

The entire experiential goal lives in that gap.

- **Easy to learn** — any screen is graspable at a glance. The next decision is always obvious. You can play a full window on a phone, one-handed, on a couch or a bus, without a manual, without a tutorial wall.
- **Hard to master** — underneath the friendly surface sit the deep systems we built: the hidden leans, the freshness decay, the coverage triage, the variance math, the long golden-generation arcs. Mastery is reading the world correctly and making the right call under uncertainty — not memorizing menus.

The depth is **earned, not displayed.** A new player sees a clean, colorful decision. An expert sees the same screen and reads five layers of consequence in it. Same screen. That's the target.

---

## What This Game Is NOT

State the anti-pattern plainly so it can't creep in:

- **Not OOTP. Not Football Manager.** Those are magnificent, but they are dense data terminals — grids of numbers, dozens of nested menus, a season-long learning curve. They look like spreadsheets wearing a lanyard.
- **Not a spreadsheet.** If a screen's primary visual is a dense table of numbers, it has failed the vibe. Numbers exist, but they are surfaced selectively, visually, and only when they inform the decision at hand.
- **Not a desktop app shrunk to fit a phone.** This is designed for the phone first; a larger screen is a bonus, never the assumption.
- **Not exhaustive.** It does not simulate everything. It simulates the *national manager's* slice — selection, advice, courting, observation — and abstracts the rest. (See every "out of scope" line in the bibles; they are features.)

---

## The Five Feel Pillars

### 1. Colorful
The game has a **bold, vibrant visual identity** — closer to a polished mobile sports game than a database front-end. Strong color, clear iconography, expressive type. Nations have color and flavor. The world feels alive and a little bit fun, not clinical. Color is also *functional*: it encodes meaning (form, urgency, freshness, threat) so the player reads state at a glance instead of parsing numbers.

### 2. Fast (the speed pillars, restated as feel)
- A match: 2–5 minutes.
- A window: 5–15 minutes.
- A full season: under an hour.

Speed is a *feeling* of momentum — taps resolve instantly, the calendar advances with a satisfying rhythm, nothing makes you wait. The game respects that it's being played in the gaps of someone's day.

### 3. One-Handed, One-Decision-at-a-Time
Every screen answers a single question: **"What am I deciding right now?"** If a screen has no decision, it's a results/story screen and should be glanceable and quick to dismiss. Core gameplay is fully playable with one thumb. No screen requires deep navigation to reach a decision.

### 4. Tap, Don't Type
Decisions are **choices presented**, not data entered. Pick from options, tap a player, choose a formation, send a scout — never fill in a form. The interface offers; the player selects. This is what makes it couch/commute-friendly and keeps the cognitive load on *strategy*, not *operation*.

### 5. Story Over Stats
Players remember wonderkids, upsets, golden generations, the dual-national who chose them at the last second, the World Cup run. They do not remember tables. The **news feed is the heart of the experience** — the place the world tells you its stories and the place you act on them. The game is a story generator with a management engine underneath, not the reverse.

---

## The Feel of the Core Loop

The loop should feel like **reading a living world and making a few sharp calls**, not administering a database:

1. Open the feed → the world tells you what happened and what's brewing (colorful, glanceable headlines).
2. A few of those headlines want a decision → tap to act (send a scout, court a kid, advise a move, pick a squad).
3. Play your match → fast, tense, a few meaningful tactical choices, an instant result with drama.
4. Advance → the world moves, new stories emerge.

The player should feel like a **decisive national manager reading the room**, never like a clerk doing data entry. Each session leaves a story residue — something happened worth remembering.

---

## Depth Without Density — The Core Tension

This is the hardest and most important design discipline in the whole project. The depth must be **felt, not shown.**

- The hidden lean is depth — but the player just sees "he's considering it."
- The freshness decay is depth — but the player just sees a rating going fuzzy.
- The variance math is depth — but the player just feels the upset land.
- The coverage triage is depth — but the player just chooses where to send a scout.

Every deep system resolves, at the surface, to a **simple, colorful, tappable choice.** When a system threatens to surface its machinery as a table of numbers, that's the signal to redesign the presentation, not the system. The complexity lives in the *consequences*, not on the screen.

---

## The Tiebreaker Test

When any implementation choice is unclear, ask in order:

1. **Can a new player understand this screen in five seconds?** If no, simplify the presentation.
2. **Is the decision obvious, even if the right answer isn't?** The player should always know *what* they're choosing, even when *which* is hard.
3. **Does it work one-handed on a phone?** If it needs two hands or a big screen, redesign.
4. **Is it colorful and alive, or is it a spreadsheet?** If it reads as a data grid, it's wrong.
5. **Does it generate or surface a story?** The best screens do.

If a feature passes the systems bible but fails these, the **feel wins.** A mechanically rich feature that feels like FM is a worse fit for this game than a simpler one that feels like *this*.

---

## The Elevator Pitch

> A colorful, pick-up-and-play international football management game for your phone. Pick a nation, build a squad, chase wonderkids across the globe, and take them to the World Cup. Easy to learn in one window, deep enough to master over many. The stories you make are the game.

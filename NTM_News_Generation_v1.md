# National Team Manager — News Generation

## Bible Section v1.0

---

## Overview

The news feed is the game's **primary storytelling engine and its primary interface.** It is the hub every other system feeds into: the match engine, development, eligibility, scouting, transfers, and tournaments all emit events, and the news feed is where those events become readable, story-shaped, and — where relevant — **actionable.**

The feed is the difference between a simulation running in the dark and a living football world. It is also, per the scouting section, the *interface* through which the player reads the world and acts on it in the same place — the mobile-first dream where the whole game loop can run through the feed.

**Generation approach: template-driven, not generative.** No LLM at runtime. Pre-written phrasing banks with data-filled slots are fast, free, offline-capable, and reliable — exactly fitting the speed and mobile-first pillars. Staleness is beaten by a **deep, growable template database**, not by generative prose.

---

## Part 1 — Architecture: Events → Priority → Feed

### 1. Everything is an Event (structured data, not text)
Every system emits structured events. Text is generated only at render time.

```
{
  type: "WONDERKID_EMERGING",
  subject: player_id,
  context: { club, age, rating_jump, league },
  magnitude: 0.8,        // how big a deal this is (0–1)
  scope: "your_pool",    // relevance tier
  actions: [ ... ]       // optional tappable actions
}
```

### 2. Events get a priority score
Not every event deserves attention. Score each by **magnitude × relevance to the player.**

- A player in *your* pool emerging → high priority (top of feed).
- A dual-national you're chasing getting a rival approach → urgent (flagged).
- A transfer in an uncovered league involving nobody relevant → low (may be filtered out entirely).

Priority scoring keeps the feed **useful, not a firehose.** On a mobile screen showing a handful of items, the player must get the *right* handful.

### 3. The feed renders top events as templated headlines
Take the highest-priority events for the period, run each through its template bank, fill the slots, present.

---

## Part 2 — Feed Ordering: Hybrid

- **Priority-sorted *within* each window/period** — the most important news of a period surfaces first; nothing big scrolls past unseen.
- **Chronological *across* periods** — older periods sit below newer ones, preserving the timeline feel of a real news feed.

This is the best of both: never miss the big stuff, still reads like a living timeline.

---

## Part 3 — Feed Mix: Mostly Yours, Seasoned With the World

Target roughly **70% personal / 30% world news.**

- **Personal (your pool, your nation, your leads)** dominates — the player's decisions and players stay front and center.
- **World seasoning** (a rival's golden generation, a massive transfer elsewhere, a shock result in another confederation, ranking upheavals) adds atmosphere and *context* for decisions without burying what matters.

This keeps the world feeling alive without making the feed insular. (Ratio is a tunable constant — adjust in playtesting.)

---

## Part 4 — Event Taxonomy

The news engine is a renderer; the inputs are already defined by the systems built so far.

| Source system | Events it emits |
|---|---|
| **Match engine** | Results, upsets, thrashings, individual heroics (hat-tricks, MOTM), injuries |
| **Development** | Wonderkid emerging, player breakout, veteran decline, retirement |
| **Eligibility** | Dual-national hype, rival nation circling, cap-tie alerts (yours and losses), "considering" states |
| **Scouting** | Lead generation ("worth a look"), confirmation or bust after a targeted look |
| **Transfers (club sim)** | Player moves club, big-money transfer, move into/out of your coverage |
| **Tournament** | Draw results, qualification clinched/missed, seeding changes |
| **World / flavor** | Golden generation arrives, managerial milestones, ranking shifts |

---

## Part 5 — Template Banks (the anti-staleness engine)

Each event type carries a **bank of phrasings** (target ~4–8 each, growable indefinitely), selected at random, with slots filled from the event's rich context data.

Example bank for `WONDERKID_EMERGING`:

- "{player}, just {age}, is the name on everyone's lips after lighting up the {league}."
- "A star is emerging at {club}: {age}-year-old {player} can't stop scoring."
- "Is {player} the real thing? The {age}-year-old has forced his way into the conversation at {club}."
- "{club}'s {age}-year-old {player} is making people sit up and take notice."

The math of variety: ~7 event types × ~6 phrasings × rich slot variety (names, ages, clubs, leagues, scorelines) keeps the feed fresh for a long time with no LLM. **Because templates are pure data, the bank can grow forever with zero code changes** — ship a solid set, keep adding.

**Slot-data discipline:** the richer the context passed into an event, the more varied the output. Always populate the full context object even when a given template doesn't use every field — it lets you add fancier templates later without touching the emitters.

---

## Part 6 — The Actionable Feed (information + story in one place)

The feed is not just flavor — it's a **functional interface.** Events carry **tappable actions** where relevant, so reading and acting happen in the same place:

| Event | Tappable action | What it does |
|---|---|---|
| `WONDERKID_EMERGING` (uncovered league) | **Send a scout** | Spends a coach's targeted look |
| `RIVAL_CIRCLING` (eligibility) | **Make contact** / **Call up** | Enters the persuasion flow |
| `VETERAN_DECLINE` | **Address it** | Triggers the advisory event flow |
| `DUAL_NATIONAL_CONSIDERING` | **Push** / **Give space** | Advances the "considering" state |
| `WASTED_TALENT` | **Advise a move** | Raises transfer probability (with risk) |

This is the mobile-first payoff: the entire core loop — observe, decide, act — can run through the feed.

---

## Part 7 — How the Feed Closes the Loop

The news feed is the connective surface that the whole game runs on:

1. Systems simulate invisibly (development moves ratings, transfers move players, rivals court dual-nationals).
2. Notable changes emit **events.**
3. Events are **prioritized** and rendered as **headlines** in the hybrid-sorted feed.
4. Relevant headlines carry **actions** the player taps to respond.
5. Those actions feed back into the systems — a scout is sent, a youngster is courted, a move is advised.
6. The consequences emit **new events** next period.

The feed is where the simulation becomes a game.

---

## Implementation Notes for Claude Code

- Define an `Event` type with: `type`, `subject(s)`, `context` object, `magnitude` (0–1), `scope`/relevance tier, and optional `actions` array.
- Every system emits `Event` objects into a shared queue — emitters never write display text.
- A **priority scorer** computes `priority = magnitude × relevanceWeight(scope, player)` and sorts; apply a cutoff so low-priority noise is filtered before render.
- Template banks are **data** (JSON or similar), keyed by event type, each an array of phrasing strings with `{slot}` markers. Render = pick a random phrasing, fill slots from `context`.
- Feed ordering: group by period, sort by priority within period, order periods chronologically (newest period on top).
- Feed mix: when assembling a period's feed, target ~70/30 personal/world by including a capped number of world-scope events alongside personal ones. Ratio is a tunable constant.
- Actions are declared on the event by the emitting system (the emitter knows whether the league is covered, whether the player is a chase target, etc.). The feed just renders and dispatches them.
- Keep the full `context` populated on every event even if current templates don't use every field — future template additions then need no emitter changes.

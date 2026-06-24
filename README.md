# National Team Manager (NTM)

A mobile-first international football management game. You manage a single **national team** through qualifying campaigns, continental championships, and World Cups. You do **not** manage clubs.

**Core fantasy:** a selector and advisor — pick squads, court dual-national wonderkids, advise moves, scout your scattered player pool, and read a living football world through a news feed.

**Pillars:** fully procedural · US-trademark-safe (no real names, teams, or competitions) · easy to learn, hard to master · fast · one-handed mobile play.

---

## For Claude Code — Read This First

This repo contains a complete design package across the documents in `/docs`. **The systems interlock heavily — read all of `/docs` before writing any code.** Then produce a build plan for approval *before* implementing. See the kickoff instructions the project owner (Joe) provides; the short version:

1. Read everything in `/docs`.
2. Propose a build plan (tech stack + reasoning, project structure, data-model sketch, implementation order). Get approval before coding.
3. Flag open threads you'd need resolved before building (some are listed below).
4. Build incrementally; keep it playable end-to-end as early as possible.
5. When the system bibles and `The Vibe` conflict on *presentation/feel*, **The Vibe wins.** Ask on real design forks.

---

## Technical Target

- **Installable PWA** — web app + web app manifest + service worker (offline play, home-screen install).
- **Offline-first with durable local saves** — all game state (careers, squads, full simulation state) persists in IndexedDB / local storage, survives sessions, runs with no network.
- **Mobile-first, one-handed, tap-not-type.**
- **Capacitor-ready** project structure so it can later be wrapped for app-store distribution without a rewrite.
- Owner's existing workflow is single-HTML-file / no-build-step, but a light build setup (e.g. Vite + React) is on the table if justified. Recommend an approach in the build plan.

---

## How It All Fits Together

The systems form a renewable loop — every piece feeds the next:

```
Youth Generation  →  seeds players + dual-national eligibility
        ↓
Development        →  moves real ratings invisibly (at clubs)
        ↓
Scouting           →  coverage determines how current your knowledge is
        ↓
News Generation    →  surfaces what's happening + offers actions
        ↓
Player decisions   →  call-ups, courting, advice, squad selection
        ↓
Match Engine       →  resolves matches, emits results/events
        ↓
Tournament/Calendar→  the container it all runs inside
        ↓
(new youth intake each year — loop renews)
```

No system is designed in isolation. Match results emit news events; youth generation is the spawn point for the eligibility system; scouting coverage drives the rating-freshness model; the news feed is both the storytelling engine *and* the primary interface for taking action.

---

## Document Index (`/docs`)

**Read in this order.**

### Start here — the soul
- **`NTM_The_Vibe_v1.md`** — the experiential identity and feel spec. Defines what the game should feel like to hold, and why it must NOT feel like OOTP or Football Manager. Has veto power over presentation decisions. Read first so every system is built with the right feel in mind.

### The six core systems
1. **`NTM_Match_Engine_v1.md`** — zone-based strength, modifiers, tactical matchups, Poisson resolution. Variance tuned "a hair wider than tight." The engine every match runs through.
2. **`NTM_Development_and_Eligibility_v1.md`** — automated club-driven development, advisory events, and the dual-national persuasion layer (hidden lean, probing, cap-tying). The two player levers: who to cap, when to advise a move.
3. **`NTM_Tournament_Structure_v1.md`** — generic confederations, four-year cycle, real-world qualifying formats, inter-confederation playoffs, the international calendar, friendly scheduling, and the three-tier match resolution model.
4. **`NTM_Staff_and_Scouting_v1.md`** — standing league assignments, coverage-driven rating-freshness decay, targeted looks. Scouting is "where do I point my eyes."
5. **`NTM_News_Generation_v1.md`** — the event→priority→feed hub. Template-driven (no runtime LLM), hybrid-sorted, actionable headlines. The storytelling engine and primary interface.
6. **`NTM_Youth_Generation_v1.md`** — silent, population-scaled, right-skewed potential distribution, golden generations, dual-national seeding. The renewable source of the talent pipeline.

### Procedural foundation
- **`NTM_Name_Generation_v1.md`** — the procedural player-name system: two-tier pool model (full national pools for the 25 playable nations + ~12 regional fallback pools), naming conventions, and the data schema.

---

## Data (`/data`)

- **`ntm_name_pools_v1_cleaned.json`** — the populated name pools (37 total: 25 national + 12 regional), conforming to the schema in `NTM_Name_Generation_v1.md`. Real-name avoidance is handled at the data layer. Pools are editable data — names can be added/removed with zero code changes.

---

## Scope Anchors (do not drift)

- **National teams only.** No club management, no league tables, no transfer negotiations (transfers are automated and surfaced as news).
- **Procedural and trademark-safe.** No real player/team/competition names. Generic confederation labels (EFU, SAC, NCC, AFU, ASC, OFU).
- **The manager's slice only.** Select, advise, court, observe. The manager never runs training sessions or club development he wouldn't realistically control.
- **Depth is felt, not displayed.** Hidden systems resolve to simple, colorful, tappable choices. If a screen reads like a data grid, it's wrong (see The Vibe).

---

## Open Threads (to resolve with the owner — not blocking the build plan)

These are known-undecided. Flag any others you find.

1. **Staff size / hiring currency** — how many coaches the manager has, and what (if anything) hiring costs. Options discussed: fixed at game start, or reputation-gated (no finances). The design intent is that *assignment*, not acquisition, is where the decisions live.
2. **Manager career progression** — is there a career arc (getting hired by better nations over time), or does the player pick one nation and stay? This touches "reputation," which several systems reference.
3. **Core-loop / new-game flow doc** — does not yet exist. The minute-to-minute orchestration (new-game setup → window → window → season → cycle) that stitches the six systems into actual play. Likely worth writing early, possibly as the first thing built around.

---

## Playable Nations (25)

**EFU (Europe):** England, France, Spain, Germany, Italy, Portugal, Netherlands, Belgium, Croatia, Serbia
**SAC (South America):** Brazil, Argentina, Uruguay, Colombia
**NCC (North/Central):** United States, Mexico
**AFU (Africa):** Morocco, Nigeria, Senegal, Ghana, Cameroon
**ASC (Asia):** Japan, South Korea, Australia
**OFU (Oceania):** New Zealand

All other nations exist as non-playable, carrying three ratings (Nation Rating, Youth Rating, Tactical Identity) and a name-pool assignment — no squad generated until needed.

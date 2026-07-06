# NTM — Development Guide

Mobile-first PWA. Vite + React + TypeScript + Zustand. Offline-first with durable
IndexedDB saves. Structured so it can be wrapped with Capacitor later with no rewrite.

## Commands

```bash
npm install      # install deps
npm run dev      # dev server (open on your phone via the LAN URL Vite prints)
npm run build    # type-check + production build to dist/
npm run preview  # serve the built dist/ locally
npm run test     # vitest engine tests
```

To play on your phone during development: run `npm run dev`, then open the
`http://<your-LAN-ip>:5173` URL Vite prints on your phone (same Wi-Fi). To test
the installable PWA, `npm run build && npm run preview` and add to home screen.

## Architecture

- **`src/engine/`** — pure simulation. No React, no storage, no globals. Inputs in,
  results + events out. Seedable RNG (`rng.ts`) makes everything reproducible.
- **`src/data/`** — pure design data: nations, formations, name pools, tuning
  constants (`constants.ts` holds every tunable lever — match variance, etc.).
- **`src/state/`** — Zustand store (`store.ts`) + IndexedDB persistence
  (`persist.ts`). The whole game state is one serializable `Career` object,
  debounce-autosaved.
- **`src/ui/`** — React screens/components. Functional color (`theme.css`) encodes
  form / freshness / urgency. One decision per screen.

### Key invariant (scouting)
A player's displayed rating is a *scouted read* whose sharpness depends on
`freshness`; the real rating lives hidden on the player and is moved by the
(future) development engine. `displayOverall()` in `ui/display.ts` is where the
fuzziness surfaces. Never render hidden values (potential, leans, injuryRisk) raw.

## Status

### Milestone 0 — the shell (done)
- Installable PWA + service worker + offline; IndexedDB save/load/continue.
- Title → New Game (nation → manager name → style) → week-by-week schedule hub.
- News feed (placeholder bank), week advance with calendar roll + freshness decay.
- Menu: Squad (drag-to-position formation board), Player Pool, Dual Nationals,
  Settings (volume/difficulty grayed out), Save, Main Menu.
- Nation-authentic name generation wired to the cleaned name-pools data.
- Lightweight squad generator so every tab has real content.

### Milestone 1 — match engine + a playable match (done)
- Full six-step engine in `engine/match.ts`: zone strength → form/style/home
  modifiers → midfield matchup edge → xG → independent Poisson → narrative
  back-fill (scorers, injuries, ratings, MOTM). Pure, seedable, no side effects.
- Tier-3 lite resolver (`engine/matchLite.ts`) for non-playable nations.
- `engine/matchSetup.ts` builds team views + AI opponent (deterministic squad
  regen, identity→formation mapping).
- Playable "Friendly" flow: Schedule → pick opponent/style/venue → Kick Off →
  animated scoreline, possession/xG bars, scorers, MOTM, player ratings.
  Result nudges player form and emits a feed headline.
- All tuning constants in `data/constants.ts`. Balanced matches ~1.3 xG/side.

  NOTE: final match balance waits on real squads — the placeholder squad
  generator compresses the elite-vs-minnow gap, so favorite-win% will sharpen
  once the youth/development model lands.

### Milestone 2 — the living talent model (done)
- Real two-stage generation: hidden potential drawn from a right-skewed lottery
  (shifted by Youth Rating, floored by Football Culture); senior squads anchored
  near nation strength with potential derived as age-appropriate headroom.
- Hidden/known split in the player model: real ratings/potential are hidden and
  moved by the development engine; the UI renders only the last scouted read
  (`knownOverall`/`knownPotential`), blurred by freshness.
- Development engine (`engine/development.ts`): young players grow toward
  potential gated by playing time (benched kids stall); veterans decline past
  peak (GK/DF slower). Floats accumulate so weekly change isn't rounded away.
- Annual silent youth intake (`engine/youth.ts`): size scales with pool depth,
  rare golden-generation flag, small dual-national fraction. No notification.
- Scouting coverage (`engine/scouting.ts`) + Scouting screen: assign 3 coaches
  to leagues; covered pool stays sharp, uncovered drifts fuzzy.
- News feed hypes emerging kids from their real hidden ability (never reveals
  the number) — discovery happens through feed + coverage, nothing hand-placed.
- Fixes the earlier match-balance caveat: squads now have proper spread.

### Milestone 3 — squad selection + international calendar (done)
- Window calendar (`data/windows.ts`): five international windows a year, each
  with a match week and a registration deadline the week before.
- 26-man squad registration (`engine/fixtures.ts`): pick your 26 from the full
  pool with position minimums (3 GK / 7 DF / 7 MF / 3 FW), live validity.
- Registration DEADLINE: the 26 lock the week before a window through its match;
  rolls to the next window (and reopens) once the match is played.
- Squad Selection screen (tap to call up / drop, lock-aware). Schedule hub shows
  the next window, opponent, venue, deadline countdown / lock, and a Select
  Squad button; the match week swaps Advance Week for Play Match.
- Match screen plays the scheduled window fixture (deterministic opponent +
  venue); the registered 26 all get exact in-person reads afterward.

NOTE: window opponents are friendlies for now; real qualifying groups /
tournaments / tables replace the opponent pick in the tournament milestone (the
window + deadline machinery stays).

### Milestone 4 — tactics + qualifying campaign (done)
- Tactics tab (Squad): persistent formation + style + focal point, driving the
  match engine; the focal point funnels chances and risks on his form.
- "Send a scout" actions on hype headlines; pool highlight; top-3 stars.
- World Cup qualifying campaign (`engine/campaign.ts`): a 6-nation group, double
  round-robin, live table. Window fixtures are now qualifiers against group
  opponents; the OTHER group fixtures each matchday are simmed (Tier 2 full
  engine for playable nations, Tier 3 Poisson for filler) so the table stays
  alive. Top 2 qualify; on completion a qualification news beat fires and the
  next campaign begins. Standings screen with the group table + latest results.
- Filler nations (`data/fillerNations.ts`): non-playable, ratings-only sides per
  confederation so groups fill out (and OFU stays tiny).

### Milestone 5 — finals tournaments + the 4-year cycle (done)
- Summer knockout finals (`engine/tournament.ts`): seeded single-elimination
  brackets. Continental Championship in cycle year 1 (top of your confederation,
  8 or 4 teams, you always in); World Cup in cycle year 4 (top 16 worldwide,
  you in only if you qualified). Your ties are played through the full engine,
  the rest simmed (Tier 2 / Tier 3); draws settled on penalties.
- Calendar (`data/windows.ts`): finals block (deadline wk24, rounds 26-32),
  `tournamentForYear`; squad locks through the block; old tournament cleared on
  the cycle rollover. Trophies banked to `career.trophies`.
- Bracket screen + knockout match framing + finals-aware feed (draw / result /
  elimination / champion beats) + a Finals menu entry while one is live.

### Milestone 6 — the living world (done)
- Dynamic nation ratings (`engine/world.ts`): Elo-style, moved by EVERY
  competitive result — the manager's matches, simmed group fixtures, finals
  ties (neutral, shootout-aware, margin-amplified), plus background windows the
  rest of the world plays each window week and the other confederations' own
  continental championships. Zero-sum, clamped, with a soft seasonal reversion
  toward each nation's cultural base so identities persist while eras happen.
- Generational world squads (`playerGen.generateSquadForNation`): every AI
  nation's squad is a set of persistent virtual careers derived from
  (seed, nation, slot, generation) — stable names, ages that advance each
  season, an age curve (rise → peak 26-29 → decline), staggered individual
  retirements, occasional generational stars. Zero save cost; overlapping high
  peaks ARE a golden generation.
- Everything reads the live ratings: qualifying group draws, tournament fields
  and seedings, lite-sim strength, the penalty decider, opponent squad quality
  and the match screen's opponent line ("8th in the world").
- World Rankings screen (menu): live table with season movement arrows and the
  World Cup seeding cutline. Season-end news beats for big risers/fallers and
  the manager's own movement; a news item when foreign continents crown champions.

### Not yet built (next milestones)
1. Confederation-specific qualifying formats (league/hex/group variants) and
   inter-confederation playoffs; align the 2-year qualifying campaign to the
   4-year cycle (currently every other campaign's result is never consumed).
2. Eligibility/persuasion (courting a dual national, rival-AI clock). The data
   model (leans, eligibleNations, eligibilityState, tiedNation) and the Dual
   Nationals screen exist; the interactive courting loop does not. Needs
   friendlies back as a courting tool.
3. Trophy cabinet / honours UI (`career.trophies` is banked but never shown);
   injuries with consequences (match injuries are currently flavor only);
   squad-lock fix when not at the finals; neutral-venue manager finals ties.
4. Template-driven News engine (events → priority → feed mix). Current feed is
   hand-written template banks, not the bible's event-priority system.
5. Offline service worker re-enabled (network-first) before release — currently
   self-destroying to kill stuck SWs.
6. Manager progression (move nations, get sacked, skills) — deferred per design.

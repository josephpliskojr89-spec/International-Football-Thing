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

### Not yet built (next milestones)
1. Discovery polish: actionable "send a scout" from a hype headline (targeted
   look wired to the feed), confirmation/bust outcomes.
2. Real calendar fixtures, qualifying formats, tournaments, rankings/seeding
   (wires Tier 1/2/3 into actual scheduled windows).
3. Eligibility/persuasion (leans, courting, rival-AI clock) + actionable feed.
4. Template-driven News engine (events → priority → feed mix).
5. Manager progression (move nations, get sacked, skills) — deferred per design.

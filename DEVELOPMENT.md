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

## Status — Milestone 0 (the shell)

Built and playable end-to-end:
- Installable PWA + service worker + offline; IndexedDB save/load/continue.
- Title → New Game (nation → manager name → style) → week-by-week schedule hub.
- News feed (placeholder bank), week advance with calendar roll + freshness decay.
- Menu: Squad (drag-to-position formation board), Player Pool, Dual Nationals,
  Settings (volume/difficulty grayed out), Save, Main Menu.
- Nation-authentic name generation wired to the cleaned name-pools data.
- Lightweight squad generator so every tab has real content.

### Not yet built (next milestones)
1. Match engine (6-step, Tier 1/2/3 resolution) + Match screen.
2. Real calendar fixtures, qualifying formats, tournaments, rankings/seeding.
3. Youth intake, development engine, golden generations.
4. Scouting coverage (coach league assignments + targeted looks).
5. Eligibility/persuasion (leans, courting, rival-AI clock) + actionable feed.
6. Template-driven News engine (events → priority → feed mix).
7. Manager progression (move nations, get sacked, skills) — deferred per design.

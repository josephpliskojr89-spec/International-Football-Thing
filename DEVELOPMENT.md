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

### Milestone 7 — the long game (done)
Audit closure + the "alternate football history" layer:
- 4-year cycle realigned: year 1 = friendlies + Continental summer; years 2-3 =
  the 10-matchday qualifying campaign (concludes BEFORE the World Cup it feeds,
  drawn fresh each cycle with a news beat); year 4 = warm-up friendlies + the
  World Cup. Friendlies are back (`friendlyFixture`): low Elo stakes, in-person
  reads, and the warm way to court dual nationals.
- Injuries have consequences: match injuries persist (`injuredWeeks`), heal
  weekly, auto-lineup avoids the injured, kickoff swaps hurt starters for bench
  cover, 3+ week blows make the news.
- World Cup hosts (`pickWorldCupHost`): awarded per cycle (never back-to-back,
  culture-weighted, deterministic), announced years ahead, auto-qualified,
  home-advantage ties while everyone else plays neutral venues (matchLite has a
  neutral mode; manager finals ties honor host/neutral too). Sometimes it's YOU.
- Squad lock fairness (unlocked when eliminated/not at the finals), shootout
  scores everywhere (bracket, drama news), holders-out + giant-killing news.
- Eras engine (`world.trends`): bounded mean-reverting development trends per
  nation shift where ratings settle across decades — sleeping giants, declining
  powers, era headlines. Botswana-proof by clamps + culture-weighted volatility.
- The courting war: weekly rival-nation clock on uncommitted dual nationals
  (quality- and rival-strength-driven), warning news, permanent LOSS with squad
  reconciliation; `courtPlayer` staff visits (trophies help), friendly caps
  warm leans, competitive caps CAP-TIE forever. Dual Nationals screen rebuilt.
- Legacy layer: caps + international goals tracked, retiring greats enter the
  Pantheon, manager P/W/D/L record, trophy cabinet, and the World Football
  Almanac (`career.history`) — every champion, host, qualification, POTY and
  legend, season by season with real-year labels (`displayYear`). Legacy screen.
- Awards (`engine/awards.ts`): World Player of the Year (drawn from every
  nation's living generational squad + your pool, silverware-weighted,
  deterministic — award dynasties happen); Player of the Tournament at finals.

### Milestone 8 — the manager's career (done)
- Reputation (0-100, labeled): moved by qualification, trophies (+25 WC / +12
  continental), and the board's cycle verdict. Shown on Legacy.
- Board objectives per cycle, scaled to world rank (semis / quarters / qualify /
  be competitive), announced in the feed, judged as each cycle closes.
- SACKINGS: fail the board with a shredded reputation and you're out — but 2-3
  weaker federations always call. Job offers screen; the world, almanac, record
  and reputation all travel with you. Getting sacked by a giant and rebuilding
  a minnow is a feature, not a game over.
- Poaching: succeed with high reputation and a stronger nation may make an
  approach — take the giant's job or stay loyal (small rep reward, fan love).
- All-time World Cup roll of honour on Legacy (dynasties visible, yours starred).

### Milestone 9 — the real World Cup + The Final Whistle (done)
- World Cup group stage: seeded draw (pot 1 tops groups A-D, snaking pots), 4
  groups of 4 with live tables, draws allowed, 3 matchdays (weeks 25/26/27)
  then QF (A1vB2...) / SF / Final (29/30/32). Group-of-death call on the draw,
  a final-matchday scenario beat after MD2 ("win and pray"), a group verdict
  beat, host home-advantage throughout. Continental stays pure knockout; old
  saves' in-flight knockouts keep the legacy schedule (`stepWeeks`).
- Tournament engine reworked around STEPS (group MDs + KO rounds), resolvers
  return per-match results for Elo/news; bracket screen renders group tables
  above the knockout tree.
- The Final Whistle (Legacy → button): your career rendered as a story —
  epitaph, the numbers, nations managed, sackings survived, trophies in gold,
  the moments they'll retell — with "one more cycle" or retire-for-real.

### Milestone 10 — the lifeline, the rivals & The Road Not Taken (done)
- Intercontinental Playoff: finish 3rd in qualifying and the first window of
  World Cup year is one match vs a similarly-ranked side from another
  confederation — draw goes to penalties, winner boards the plane. News,
  history, reputation stakes all wired.
- Rival dugouts: every nation has a named manager (deterministic 4-7 season
  tenures) and your head-to-head duel vs each nation persists forever — the
  match screen narrates it ("They lead this duel 3-1 — a score to settle").
- Late drama: one-goal matches settled at 88'+ get their own sentence in the
  headline ("Won at the death — 93'.").
- THE ROAD NOT TAKEN (`engine/counterfactual.ts` + Ghost screen): the
  deterministic engine re-simulates the ENTIRE timeline without the manager —
  background windows, all continental championships, ghost World Cups, era
  drift — and lays both histories side by side: "N of M World Cups have a
  different name on the trophy because you exist." Only possible because every
  system in the game is seeded and reproducible.

### Milestone 11 — the storyteller & Succession (done)
- Match commentary (`engine/matchStory.ts`): every full-time screen gets a
  written story derived deterministically from the result's own events —
  comebacks, collapses, routs, late winners ("the kind of minute that gets
  named after a player"), xG verdicts (smash-and-grab / football owes you
  one), stretcher worries, MOTM praise. Fixed a regression where the Full
  Time screen was unreachable (result render now precedes the no-match guard).
- SUCCESSION (New Game+): retire via The Final Whistle and hand the SAME world
  to a new manager — same seed (generational rivals continue mid-career),
  evolved ratings/trends, the full almanac and Pantheon inherited; new nation,
  fresh reputation, era-scoped Ghost comparisons (`eraStartSeason`). One
  timeline, many managers.
- Golden Boot: your tournament top scorer named when a finals concludes.

### Milestone 12 — the realism pass (done)
- Club football realism (`data/leagues.ts` + `playerGen.assignClub`): 15 named
  leagues with trademark-safe club pools ("Mersey Rovers", "Milano Rossoneri",
  "Buenos Aires Xeneize"...). Assignment is nationality-aware: big-five nations
  keep ~80% of players domestic; exporter nations (BRA/ARG/NED/POR/MEX/USA/JPN)
  send stars to the elite leagues and keep depth home; minnows export their
  best. Scouting coverage inherits the richer league map automatically.
- The weeks between windows are alive: Club Watch (2 dispatches/week following
  YOUR players at their clubs — goals, clean sheets, bench worries, form
  wobbles, driven by real form/playing-time), club-duty injuries with news
  (the call every international manager dreads), and a "⏩ To next event"
  fast-forward that stops at matches, deadlines, sackings, offers, or big news.

### Milestone 13 — the full realism pass (done)
- Transfer windows (weeks 2-4 & 33-35): players whose club no longer matches
  their level MOVE — the wonderkid earns his big transfer (with a playing-time
  risk at the new level), the fading veteran slides down a tier, freshness dips
  while your scouts find the new ground. A trickle, not a flood.
- Severe injuries: ~8% of club-duty injuries are the dreaded one — ruptured
  ligaments, months out ("Plans change today").
- Career texture in the aftermath engine: notable debuts (flood-guarded to 2
  per match, youth/scorers only), 50th/100th cap milestones ("A CENTURION"),
  hat-trick front pages.
- Camp arrivals: on deadline eve the staff report who's flying and who's flat,
  read from real club form — pick your 26 informed.
- (Scouting league picker already showed per-league pool counts + freshness.)

### Milestone 14 — season arcs, farewells & weather (done)
- Club season arcs (`engine/clubs.ts`): every club lives a deterministic
  season-long story (title race / European push / mid-table / relegation
  dogfight). Weekly form drifts with it, club-watch dispatches reference it,
  and at season's end titles are won and clubs go down — your players arrive
  at camp with medals and swagger, or carrying a bruising year.
- One last dance: a squad veteran may privately announce his final year at
  season start ("send him out right") — and he WILL retire at its end,
  guaranteed, flowing into the Pantheon as usual.
- Weather in the match stories: deterministic from the calendar — winter
  qualifiers open in sleet and frost, summer finals in punishing heat.

### Milestone 15 — discipline & silly season (done)
- Cards in the match engine (YELLOW/RED events; bookings fall on the tackling
  trades, reds rare) and in the match stories ("The game turned on his red
  card — ten men, and everything got harder").
- Tournament suspensions with REAL bite: yellows accumulate across a finals
  (two = banned for the next match, slate wiped after), straight reds ban
  immediately; suspended players are swapped out at kickoff like injuries and
  the ban is served. News narrates every booking, ban and reshuffle. Slate
  cleared when each tournament starts.
- Silly season: in the off-summer of qualifying years (weeks 28-32) the back
  pages fill with transfer speculation that tracks the SAME players the market
  logic will actually move when the window opens at 33-35.
- Confirmed: the shared club universe already holds — world squads use the
  same nationality-aware club assignment as your pool.

### Milestone 16 — the deep match engine (done)
- Two-phase simulation: each match is two halves with the half-time score in
  the result; the second half is SCORE-STATE coupled (trailing sides chase
  +10%/goal and leave gaps, leaders drop off and protect). Comebacks and
  collapses are now simulated, not narrated.
- Cards & injuries hurt TODAY: rolled first with minutes; a red card weakens
  the ten men for every remaining minute (attack -30%, shape less), an injury
  costs ~6% team-wide for the remainder. Statistically verified: red-carded
  sides concede more.
- The style wheel: HighPress > Possession > Direct > Counter > HighPress
  (Balanced outside it), ±5% attack/3% midfield. Surfaced pre-match as intel
  ("Counter is the classic answer to HighPress — be ready to adapt") so the
  Tactics tab becomes a per-opponent decision.
- Tournament fatigue: everyone who plays a finals match loses 2 form — a
  never-rotating XI arrives at the final on fumes (form already feeds zones).
- REAL knockout settlement (`settleKnockout`): 30 minutes of extra time on
  tired legs (score-state aware, scorers at 91-120'), then a KICK-BY-KICK
  penalty shootout — real takers ranked by nerve+finish vs the real keeper,
  five rounds with early mathematical stops, sudden death after. The full
  kick sequence renders on the result screen (⚽/❌ per taker), verdicts show
  WIN · PENS, headlines carry the shootout score, stories mourn "the
  loneliest walk in football".

### Not yet built (next milestones)
1. Confederation-specific qualifying formats (league/hex/group variants) and
   inter-confederation playoffs.
2. Template-driven News engine (events → priority → feed mix). Current feed is
   hand-written template banks, not the bible's event-priority system.
3. Offline service worker re-enabled (network-first) before release — currently
   self-destroying to kill stuck SWs.
4. Manager progression (move nations, get sacked, skills) — deferred per design.
5. Continental championships with real qualification (currently top-8 by rating).

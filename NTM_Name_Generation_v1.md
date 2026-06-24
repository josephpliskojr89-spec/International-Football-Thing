# National Team Manager — Procedural Player & Name Generation

## Bible Section v1.0

---

## Overview

The system bibles all assume procedurally generated players exist — "no real names," "players generated only when needed," annual youth intakes producing fresh prospects. This document defines the **name generation** that makes that work, plus the schema the name data must conform to.

The central requirement: **names must feel nationally authentic.** A national-team game lives on the fantasy of managing *your nation*. A Brazilian squad full of "John Smith" shatters immersion instantly. So the generator selects names from **nation-appropriate pools**, respecting each culture's naming conventions — while never using the names of real, famous footballers.

This is a named sub-component of the broader **player generator** (the rest of which — ratings, potential, position, club, eligibility — lives in the Youth Generation bible).

---

## Part 1 — The Player Generator (context)

When a player is generated, the generator assigns:

| Attribute | Source |
|---|---|
| **Name** | This system |
| **Nationality** | Set by context (drives the name pool) |
| Position, age, current ratings | Youth Generation bible |
| Hidden potential & traits | Youth Generation bible |
| Starting club | Youth Generation bible |
| Dual-national eligibility + second nation | Youth Generation bible |

Name generation runs off **nationality**: nationality selects the pool, the pool plus convention rules produces the name.

```
player.nationality → select name pool
                   → draw first name + surname(s)
                   → apply nation's naming convention
                   → final display name
```

---

## Part 2 — The Two-Tier Pool Model

### Tier 1 — Full National Pools (the 25 playable nations)
Each playable nation gets its own rich, authentic pool. These are the nations players manage; authenticity budget is spent here.

England, France, Spain, Germany, Italy, Portugal, Netherlands, Belgium, Croatia, Serbia, Brazil, Argentina, Uruguay, Colombia, United States, Mexico, Morocco, Nigeria, Senegal, Ghana, Cameroon, Japan, South Korea, Australia, New Zealand.

### Tier 2 — Regional / Cultural Fallback Pools (everyone else)
Non-playable nations map to a regional bucket rather than carrying a bespoke pool. Minor nations rarely surface named players, so the approximation is almost never scrutinized — slight "weirdness" is an acceptable price for not hand-building 150 databases.

**Regional buckets (~12):**

| Bucket | Covers (examples) | Convention |
|---|---|---|
| Hispanic / Latin American | Nicaragua, Paraguay, Ecuador, etc. | Double surname |
| Arabic / Middle Eastern | Lebanon, Gulf states, Iraq, etc. | Standard + particles (al-) |
| West African | Ivory Coast, Mali, Guinea, etc. | Standard |
| East African | Kenya, Ethiopia, etc. | Standard |
| North African / Maghreb | Algeria, Tunisia, Libya | Arabic-influenced |
| Eastern European / Slavic | Poland, Czechia, Ukraine, etc. | Standard (gendered surnames optional) |
| Western European | Ireland, Switzerland, Austria, etc. | Standard |
| Nordic | Sweden, Norway, Denmark, Iceland | Standard (Iceland patronymic optional) |
| East Asian | China, etc. | Surname-first |
| Southeast Asian | Thailand, Vietnam, Indonesia, etc. | Varies |
| South Asian | India, etc. | Standard |
| Pacific / Oceanian | Fiji, etc. | Standard |

### The lookup
Every nation carries **one field**: its name-pool assignment, pointing to either its own national pool (the 25) or a regional bucket (everyone else). Clean lookup, no special cases.

```
nation.namePool = "BRAZIL"        // Tier 1
nation.namePool = "HISPANIC_LATAM" // Tier 2 (e.g. Nicaragua)
```

---

## Part 3 — Naming Conventions (key conventions only)

Implement the handful of **high-impact distinctive patterns** — they carry almost all the perceived authenticity. Everyone else is simple first + surname.

| Convention | Applies to | Rule |
|---|---|---|
| **Double surname** | Spain, Argentina, Uruguay, Colombia, Mexico, Hispanic bucket | Paternal + maternal surname: "García Hernández" |
| **Portuguese particles** | Portugal, Brazil | "de," "dos," "da," "Santos" patterns |
| **Brazilian mononym** | Brazil | Sometimes a single name / diminutive ("Ronaldo"-style, but invented): generate mononym or diminutive + surname a portion of the time |
| **Surname-first** | Japan, South Korea, East Asian bucket | Display surname before given name; short given names |
| **Dutch particles** | Netherlands | "van," "de," "van der" in surnames |
| **Arabic particles** | Morocco, Arabic & Maghreb buckets | Optional "al-," "el-," "ben/bin" patterns |

Everyone not listed: **first name + single surname.** Don't over-model — diminishing returns.

---

## Part 4 — Pool Sizing

The generator runs youth intakes every year for decades across many nations, so pools must be big enough to avoid obvious repeats. Combinatorics help: 80 first × 120 surnames = 9,600 unique combos before exact repeats.

**Targets per Tier 1 national pool:**
- ~60–100 first names
- ~100–150 surnames

**Regional buckets:** same target ranges, drawing from across the represented cultures.

This is modest, manageable data — easy to seed and easy to expand later.

---

## Part 5 — The Data Schema (what the pools must conform to)

Name data is **pure data** (JSON), keyed by pool ID. Claude Code ingests this directly; it must match this shape exactly.

```json
{
  "BRAZIL": {
    "displayName": "Brazil",
    "convention": "PORTUGUESE_PARTICLES",
    "mononymChance": 0.25,
    "firstNames": ["Caio", "Bruno", "Thiago", "..."],
    "surnames": ["Almeida", "Ribeiro", "dos Santos", "..."]
  },
  "SPAIN": {
    "displayName": "Spain",
    "convention": "DOUBLE_SURNAME",
    "mononymChance": 0.0,
    "firstNames": ["..."],
    "surnames": ["..."]
  },
  "HISPANIC_LATAM": {
    "displayName": "Hispanic / Latin American (regional)",
    "convention": "DOUBLE_SURNAME",
    "mononymChance": 0.0,
    "firstNames": ["..."],
    "surnames": ["..."]
  }
}
```

**Field definitions:**
- `displayName` — human-readable label.
- `convention` — enum controlling assembly: `SIMPLE`, `DOUBLE_SURNAME`, `PORTUGUESE_PARTICLES`, `SURNAME_FIRST`, `DUTCH_PARTICLES`, `ARABIC_PARTICLES`.
- `mononymChance` — 0.0–1.0; probability the generator produces a single-name player (only non-zero for Brazil, realistically).
- `firstNames` / `surnames` — the pools.

**Assembly logic (for Claude Code):**
- Default: `firstName + " " + surname`.
- `DOUBLE_SURNAME`: `firstName + " " + surname1 + " " + surname2` (draw two surnames).
- `SURNAME_FIRST`: `surname + " " + firstName`.
- `PORTUGUESE_PARTICLES` / `DUTCH_PARTICLES` / `ARABIC_PARTICLES`: surnames already carry particles in the data, so standard assembly works.
- Mononym: with `mononymChance` probability, output a single name (from a mononym list or a diminutive of the first name).

---

## Part 6 — Ready-to-Paste Brief for ChatGPT (pool population)

> **Task:** Generate name pools for a fictional football management game. Output strict JSON matching the schema below. Do not include any commentary, only the JSON.
>
> **Critical rules:**
> 1. Use **common, plausible, ordinary** names for each culture — NOT the names of real famous footballers or celebrities. Avoid any first-name + surname combination that matches a well-known real player.
> 2. Names must be **culturally authentic** to the nation/region.
> 3. Provide **~80 first names** and **~120 surnames** per pool.
> 4. For pools flagged `DOUBLE_SURNAME`, surnames should be typical paternal/maternal surnames. For `PORTUGUESE_PARTICLES`, `DUTCH_PARTICLES`, `ARABIC_PARTICLES`, include the particles within the surname strings (e.g. "van der Berg", "dos Santos", "el-Amrani"). For `SURNAME_FIRST` pools, still list firstNames and surnames separately — the game handles ordering.
> 5. Output **valid JSON only**, keyed by pool ID, matching this exact structure:
>
> ```json
> {
>   "POOL_ID": {
>     "displayName": "...",
>     "convention": "SIMPLE | DOUBLE_SURNAME | PORTUGUESE_PARTICLES | SURNAME_FIRST | DUTCH_PARTICLES | ARABIC_PARTICLES",
>     "mononymChance": 0.0,
>     "firstNames": ["..."],
>     "surnames": ["..."]
>   }
> }
> ```
>
> **Pools needed (with their conventions):**
> - Tier 1 (national): England (SIMPLE), France (SIMPLE), Spain (DOUBLE_SURNAME), Germany (SIMPLE), Italy (SIMPLE), Portugal (PORTUGUESE_PARTICLES), Netherlands (DUTCH_PARTICLES), Belgium (SIMPLE), Croatia (SIMPLE), Serbia (SIMPLE), Brazil (PORTUGUESE_PARTICLES, mononymChance 0.25), Argentina (DOUBLE_SURNAME), Uruguay (DOUBLE_SURNAME), Colombia (DOUBLE_SURNAME), United States (SIMPLE), Mexico (DOUBLE_SURNAME), Morocco (ARABIC_PARTICLES), Nigeria (SIMPLE), Senegal (SIMPLE), Ghana (SIMPLE), Cameroon (SIMPLE), Japan (SURNAME_FIRST), South Korea (SURNAME_FIRST), Australia (SIMPLE), New Zealand (SIMPLE).
> - Tier 2 (regional): Hispanic/Latin American (DOUBLE_SURNAME), Arabic/Middle Eastern (ARABIC_PARTICLES), West African (SIMPLE), East African (SIMPLE), North African/Maghreb (ARABIC_PARTICLES), Eastern European/Slavic (SIMPLE), Western European (SIMPLE), Nordic (SIMPLE), East Asian (SURNAME_FIRST), Southeast Asian (SIMPLE), South Asian (SIMPLE), Pacific/Oceanian (SIMPLE).
>
> Generate one or a few pools per response if needed to maintain quality; do not truncate lists.

---

## Spot-Check Guidance (for Joe)

- **Well-covered cultures** (Spanish, Portuguese, English, German, French, Japanese, Korean, Italian) will come out clean — minimal checking needed.
- **Spot-check** the less-represented cultures (Senegalese, Cameroonian, Ghanaian, Croatian, Serbian) for stereotyped or repeated names.
- **Scan for accidental real footballers** — the main risk. A quick read for any famous name pairing is worth it before the data ships.
- Pools are **data**, so any name can be swapped, added, or removed later with zero code changes.

---

## Implementation Notes for Claude Code

- Name pools load as a single JSON data file keyed by pool ID.
- Each nation references one `namePool` ID (national or regional).
- The name assembler reads the pool's `convention` and `mononymChance` and builds the display name per Part 5.
- Track generated names per nation to avoid exact repeats within a reasonable recent window (cheap dedupe; the combinatorics make collisions rare anyway).
- Real-name avoidance is handled at the **data** layer (the pools simply don't contain famous names), so no runtime filtering is required — but keep the pools editable so any slipped-through name can be removed.

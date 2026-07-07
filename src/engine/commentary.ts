// The live ticker: turns a (pre-computed, deterministic) MatchResult into a
// minute-by-minute broadcast. Real events land on their real minutes; ambient
// commentary fills the spaces so a quiet half still breathes. The UI plays
// this back at ~1 game-minute per real second — you watch the match, at speed.

import type { MatchResult } from './match'
import { hashStr } from './rng'

export interface TickerEntry {
  minute: number // 1..120; shootout entries use 121+ (rendered as "PENS")
  order: number // stable sort key (events on the same minute keep sequence)
  kind: 'KICKOFF' | 'AMBIENT' | 'GOAL' | 'YELLOW' | 'RED' | 'INJURY' | 'HT' | 'FT' | 'ET' | 'PEN' | 'END'
  text: string
  homeScore: number // running score AFTER this entry
  awayScore: number
  pens?: { home: number; away: number }
}

function pick<T>(arr: T[], key: string): T {
  return arr[hashStr(key) % arr.length]
}

export function buildTimeline(result: MatchResult, week?: number): TickerEntry[] {
  const key = `${result.homeName}${result.awayName}${result.homeGoals}${result.awayGoals}${result.xgHome}`
  const entries: TickerEntry[] = []
  let h = 0
  let a = 0
  let order = 0
  const push = (minute: number, kind: TickerEntry['kind'], text: string, pens?: TickerEntry['pens']) =>
    entries.push({ minute, order: order++, kind, text, homeScore: h, awayScore: a, pens })

  push(1, 'KICKOFF', pick([
    `We're under way — ${result.homeName} against ${result.awayName}.`,
    `The whistle goes. ${result.homeName} in front of their bench, ${result.awayName} in the away colors.`,
  ], key + 'ko'))

  const lastMinute = result.extraTime ? 120 : 90
  const real = result.events.filter((e) => e.minute <= lastMinute).sort((x, y) => x.minute - y.minute)

  // Ambient minutes: ~every 8-11 minutes, deterministic, avoiding real-event minutes.
  const taken = new Set(real.map((e) => e.minute))
  const ambient: number[] = []
  let m = 5 + (hashStr(key + 'a0') % 5)
  while (m < 88) {
    if (!taken.has(m)) ambient.push(m)
    m += 7 + (hashStr(key + 'a' + m) % 5)
  }

  const dominant = result.xgHome > result.xgAway ? result.homeName : result.awayName
  const other = dominant === result.homeName ? result.awayName : result.homeName
  const AMBIENT = [
    `${dominant} knocking on the door — the pressure is building.`,
    `${other} holding their shape, waiting for the break.`,
    `A half-chance falls ${dominant}'s way; the keeper is equal to it.`,
    `Scrappy spell. Neither side can keep the ball longer than three passes.`,
    `Big block! ${other} throwing bodies in the way.`,
    `${dominant} switching the play, probing for a gap.`,
    `The tempo drops for a moment — both benches are up, pointing.`,
    `Corner comes to nothing. Goal kick.`,
    `A roar around the ground as ${dominant} win it high.`,
    `${other} finally string something together — it fizzles at the edge of the box.`,
  ]

  // Merge, in minute order: ambience + real events + phase markers.
  const merged: { minute: number; fn: () => void }[] = []
  for (const am of ambient) {
    merged.push({ minute: am, fn: () => push(am, 'AMBIENT', pick(AMBIENT, key + 'amb' + am)) })
  }
  for (const e of real) {
    merged.push({
      minute: e.minute,
      fn: () => {
        if (e.type === 'GOAL') {
          if (e.side === 'home') h++
          else a++
          push(e.minute, 'GOAL', `GOAL! ${e.playerName} scores! ${result.homeName} ${h}–${a} ${result.awayName}.`)
        } else if (e.type === 'YELLOW') {
          push(e.minute, 'YELLOW', `${e.playerName} goes into the book.`)
        } else if (e.type === 'RED') {
          push(e.minute, 'RED', `RED CARD! ${e.playerName} is off — down to ten.`)
        } else {
          push(e.minute, 'INJURY', `${e.playerName} is down... he can't continue. A worrying sight.`)
        }
      },
    })
  }
  merged.push({ minute: 45.5, fn: () => push(45.5 as unknown as number, 'HT', `HALF-TIME: ${result.homeName} ${result.homeGoalsHT}–${result.awayGoalsHT} ${result.awayName}.`) })
  merged.sort((x, y) => x.minute - y.minute)
  for (const item of merged) item.fn()

  if (result.extraTime) {
    // FT-of-90 marker slots before the ET goals (which have minutes 91+).
    const ninety = entries.filter((e) => e.minute <= 90)
    const et = entries.filter((e) => e.minute > 90)
    const hAt90 = ninety.length ? ninety[ninety.length - 1].homeScore : 0
    const aAt90 = ninety.length ? ninety[ninety.length - 1].awayScore : 0
    const marker: TickerEntry = { minute: 90.5, order: order++, kind: 'ET', text: `Ninety minutes gone — level at ${hAt90}–${aAt90}. EXTRA TIME.`, homeScore: hAt90, awayScore: aAt90 }
    entries.length = 0
    entries.push(...ninety, marker, ...et)
  }

  if (result.shootout) {
    push(120.5 as unknown as number, 'FT', `Still level after 120. It's going to PENALTIES.`)
    let hp = 0
    let ap = 0
    for (const k of result.shootout.kicks) {
      if (k.scored) {
        if (k.side === 'home') hp++
        else ap++
      }
      const who = k.side === 'home' ? result.homeName : result.awayName
      entries.push({
        minute: 121, order: order++, kind: 'PEN',
        text: k.scored ? `${k.taker} (${who})... SCORES. ${hp}–${ap}.` : `${k.taker} (${who})... MISSES! Still ${hp}–${ap}.`,
        homeScore: h, awayScore: a, pens: { home: hp, away: ap },
      })
    }
    const winName = result.shootout.winner === 'home' ? result.homeName : result.awayName
    entries.push({ minute: 121, order: order++, kind: 'END', text: `${winName} WIN THE SHOOTOUT ${result.shootout.homePens}–${result.shootout.awayPens}!`, homeScore: h, awayScore: a, pens: { home: result.shootout.homePens, away: result.shootout.awayPens } })
  } else {
    push(lastMinute + 0.5, 'END', result.extraTime
      ? `FULL TIME, after extra time: ${result.homeName} ${result.homeGoals}–${result.awayGoals} ${result.awayName}.`
      : `FULL TIME: ${result.homeName} ${result.homeGoals}–${result.awayGoals} ${result.awayName}.`)
  }
  void week
  return entries
}

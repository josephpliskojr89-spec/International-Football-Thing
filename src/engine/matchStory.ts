// The story of the match, written from the result's own events — deterministic
// prose, no RNG state: the same match always tells the same story. Comebacks,
// collapses, late winners, smash-and-grabs and unlucky batterings all get
// called what they are. This is the radio replay you read at full time.

import type { MatchResult } from './match'
import { hashStr } from './rng'

// Deterministic pick: same match, same phrasing, different matches vary.
function pick<T>(arr: T[], key: string): T {
  return arr[hashStr(key) % arr.length]
}

// Deterministic weather from the calendar: winter qualifiers are played in
// sleet, summer finals in heat. Pure scene-setting — the engine doesn't care,
// but the story should.
function weatherLine(week: number, key: string): string | null {
  if (hashStr(key + 'wx') % 10 < 4) return null // most days are just days
  if (week >= 44 || week <= 9) {
    return pick([
      'On a freezing night with sleet in the floodlights,',
      'On a pitch more frost than grass,',
      'In swirling winter rain,',
    ], key + 'cold')
  }
  if (week >= 20 && week <= 35) {
    return pick([
      'In punishing afternoon heat,',
      'On a heavy, humid evening,',
      'Under a merciless summer sun,',
    ], key + 'hot')
  }
  return pick(['Under lights on a mild evening,', 'On a fast spring surface,'], key + 'mild')
}

export function matchStory(result: MatchResult, managerIsHome: boolean, week?: number): string {
  const mine = managerIsHome ? result.homeGoals : result.awayGoals
  const theirs = managerIsHome ? result.awayGoals : result.homeGoals
  const myName = managerIsHome ? result.homeName : result.awayName
  const oppName = managerIsHome ? result.awayName : result.homeName
  const myXg = managerIsHome ? result.xgHome : result.xgAway
  const oppXg = managerIsHome ? result.xgAway : result.xgHome
  const key = `${myName}${oppName}${mine}${theirs}${result.xgHome}`

  const goals = result.events
    .filter((e) => e.type === 'GOAL')
    .sort((a, b) => a.minute - b.minute)

  const lines: string[] = []
  const wx = week !== undefined ? weatherLine(week, key) : null

  // Track the running score from MY perspective for comeback/collapse detection.
  let m = 0
  let t = 0
  let wasBehind = false
  let wasAhead = false
  for (const g of goals) {
    const isMine = (g.side === 'home') === managerIsHome
    if (isMine) m++
    else t++
    if (m < t) wasBehind = true
    if (m > t) wasAhead = true
  }

  // 1) The opening framing.
  if (mine > theirs) {
    if (wasBehind) {
      lines.push(pick([
        `${myName} came from behind to beat ${oppName}, and the noise at the end told you what it meant.`,
        `Trailing and rattled, ${myName} found something — and ${oppName} couldn't hold the line.`,
      ], key + 'cb'))
    } else if (mine - theirs >= 3) {
      lines.push(pick([
        `${myName} took ${oppName} apart. From the first whistle there was only one side in it.`,
        `A statement. ${myName} were ruthless in every phase and ${oppName} had no answers.`,
      ], key + 'rout'))
    } else {
      lines.push(pick([
        `${myName} got the job done against ${oppName} — not always pretty, always in control of the moments that mattered.`,
        `A professional win for ${myName}; ${oppName} had spells, but never the decisive one.`,
      ], key + 'win'))
    }
  } else if (mine < theirs) {
    if (wasAhead) {
      lines.push(pick([
        `${myName} let it slip. In front and comfortable, then suddenly neither — ${oppName} took everything.`,
        `A collapse that will sting: ${myName} led, wobbled, and ${oppName} smelled blood.`,
      ], key + 'slip'))
    } else if (theirs - mine >= 3) {
      lines.push(pick([
        `A chastening afternoon. ${oppName} were better everywhere it counts, and ${myName} knew it early.`,
        `${oppName} ran through ${myName} like the fixture list owed them something.`,
      ], key + 'batter'))
    } else {
      lines.push(pick([
        `Fine margins, wrong side: ${oppName} edged ${myName} in a match that could have turned on a single pass.`,
        `${myName} gave as good as they got until the scoreboard disagreed. ${oppName} take it.`,
      ], key + 'edge'))
    }
  } else {
    lines.push(pick([
      `Honours even between ${myName} and ${oppName}. Neither dressing room will be happy — that's how draws work.`,
      `${myName} and ${oppName} cancelled each other out; a point apiece and questions for both.`,
    ], key + 'draw'))
  }

  // 2) A key moment: the decisive or latest meaningful goal.
  if (goals.length > 0) {
    const last = goals[goals.length - 1]
    const lastMine = (last.side === 'home') === managerIsHome
    if (last.minute >= 88) {
      lines.push(
        lastMine && mine >= theirs
          ? `${last.playerName} settled it in the ${last.minute}th — the kind of minute that gets named after a player.`
          : `${last.playerName}'s ${last.minute}th-minute goal was the cruelest kind of late.`,
      )
    } else if (goals.length >= 2 && mine !== theirs) {
      const first = goals[0]
      lines.push(`${first.playerName} broke the deadlock on ${first.minute}', and the shape of the match followed.`)
    }
  } else {
    lines.push(`No goals — but not for lack of argument in both boxes.`)
  }

  // 3) The xG verdict: deserved, or daylight robbery?
  const xgGap = myXg - oppXg
  if (mine > theirs && xgGap < -0.8) {
    lines.push(`The numbers say ${oppName} deserved more (xG ${oppXg.toFixed(1)}–${myXg.toFixed(1)}). The scoreboard doesn't care. A smash-and-grab.`)
  } else if (mine < theirs && xgGap > 0.8) {
    lines.push(`By the chances, this was yours (xG ${myXg.toFixed(1)}–${oppXg.toFixed(1)}). Football owes you one — it rarely pays up.`)
  } else if (mine === theirs && Math.abs(xgGap) > 1.0) {
    lines.push(`One side will call it a point ${xgGap > 0 ? 'lost' : 'stolen'} — the xG (${myXg.toFixed(1)}–${oppXg.toFixed(1)}) explains which.`)
  }

  // 3b) A red card is always part of the story.
  const red = result.events.find((e) => e.type === 'RED')
  if (red) {
    const redMine = (red.side === 'home') === managerIsHome
    lines.push(
      redMine
        ? `The game turned on ${red.playerName}'s red card on ${red.minute}' — ten men, and everything got harder.`
        : `${oppName} lost ${red.playerName} to a red card on ${red.minute}', and the space opened up.`,
    )
  }

  // 4) The stretcher, if any (on either side, it changes matches).
  const injury = result.events.find((e) => e.type === 'INJURY' && (e.side === 'home') === managerIsHome)
  if (injury) {
    lines.push(`The worry: ${injury.playerName} went down on ${injury.minute}' and didn't look right.`)
  }

  // 5) The man of the match, when he's yours.
  if (result.motm && (result.motm.side === 'home') === managerIsHome) {
    lines.push(`${result.motm.name} was the best player on the pitch, and it wasn't close.`)
  }

  if (result.extraTime) {
    lines.push(
      result.shootout
        ? `Ninety minutes couldn't split them; neither could thirty more. It went to penalties — ${result.shootout.homePens}–${result.shootout.awayPens} — the loneliest walk in football, taken ${result.shootout.kicks.length} times.`
        : `It took extra time — half an hour on screaming legs — to find the difference.`,
    )
  }

  const body = lines.join(' ')
  // The opener always begins with a team name — keep it capitalized after the
  // weather clause ("On a freezing night, England came from behind...").
  return wx ? `${wx} ${body}` : body
}

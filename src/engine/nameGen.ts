// Convention-aware name assembler (NTM_Name_Generation_v1). Reads the pool's
// convention + mononymChance and builds a nation-authentic display name.
// Real-name avoidance is handled at the data layer (pools exclude famous names),
// but each pool also carries forbiddenFullNames as a runtime backstop.

import rawPools from '@/data/namePools.json'
import type { RNG } from './rng'

type Convention =
  | 'SIMPLE'
  | 'DOUBLE_SURNAME'
  | 'PORTUGUESE_PARTICLES'
  | 'SURNAME_FIRST'
  | 'DUTCH_PARTICLES'
  | 'ARABIC_PARTICLES'

interface Pool {
  displayName: string
  convention: Convention
  mononymChance: number
  firstNames: string[]
  surnames: string[]
  mononyms?: string[]
  forbiddenFullNames?: string[]
}

const POOLS = rawPools as unknown as Record<string, Pool>

export function poolExists(poolId: string): boolean {
  return poolId in POOLS
}

export function generateName(poolId: string, rng: RNG): string {
  const pool = POOLS[poolId] ?? POOLS['ENGLAND']
  const forbidden = new Set(pool.forbiddenFullNames ?? [])

  for (let attempt = 0; attempt < 8; attempt++) {
    const name = assemble(pool, rng)
    if (!forbidden.has(name)) return name
  }
  // extremely unlikely fallthrough
  return assemble(pool, rng)
}

function assemble(pool: Pool, rng: RNG): string {
  const first = rng.pick(pool.firstNames)

  // Mononym path (realistically only Brazil)
  if (pool.mononymChance > 0 && rng.bool(pool.mononymChance)) {
    if (pool.mononyms && pool.mononyms.length > 0) return rng.pick(pool.mononyms)
    return first // diminutive-style single name fallback
  }

  switch (pool.convention) {
    case 'DOUBLE_SURNAME': {
      const s1 = rng.pick(pool.surnames)
      let s2 = rng.pick(pool.surnames)
      // avoid "García García"
      let guard = 0
      while (s2 === s1 && guard++ < 5) s2 = rng.pick(pool.surnames)
      return `${first} ${s1} ${s2}`
    }
    case 'SURNAME_FIRST': {
      // pool lists names separately; game handles ordering (surname before given)
      return `${rng.pick(pool.surnames)} ${first}`
    }
    case 'SIMPLE':
    case 'PORTUGUESE_PARTICLES':
    case 'DUTCH_PARTICLES':
    case 'ARABIC_PARTICLES':
    default:
      // particles are already embedded in the surname strings in the data
      return `${first} ${rng.pick(pool.surnames)}`
  }
}

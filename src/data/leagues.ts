// The club football world — flavor and immersion, not simulation. Leagues are
// trademark-safe, each with a small pool of invented clubs so a nation's pool
// reads like a real football culture: England's squad drawn mostly from the
// English First Division, Brazil's stars abroad in Europe with the depth at
// home, minnows exporting their best and keeping the rest.

export interface League {
  name: string
  tier: 1 | 2 | 3 // 1 = elite destination, 2 = strong, 3 = the rest
  homeNations: string[] // playable nations whose domestic league this is
  clubs: string[]
}

export const LEAGUE_DEFS: League[] = [
  {
    name: 'English First Division', tier: 1, homeNations: ['ENG'],
    clubs: ['London Lions', 'Mersey Rovers', 'Manchester Athletic', 'Tyneside United', 'Birmingham Forge', 'South Coast Albion', 'Yorkshire Wanderers', 'East London Irons'],
  },
  {
    name: 'Spanish First Division', tier: 1, homeNations: ['ESP'],
    clubs: ['Real Capital', 'Catalonia FC', 'Sevilla Sur', 'Basque Athletic', 'Valencia Naranja', 'Galicia Celta', 'Madrid Rojo', 'Andalucía Verde'],
  },
  {
    name: 'German First Division', tier: 1, homeNations: ['GER'],
    clubs: ['Bavaria München', 'Ruhr Schwarzgelb', 'Rhein Fohlen', 'Hansa Nord', 'Sachsen Rot', 'Schwaben Stuttgart', 'Berlin Eisern', 'Werk Rheinland'],
  },
  {
    name: 'Italian First Division', tier: 1, homeNations: ['ITA'],
    clubs: ['Milano Rossoneri', 'Milano Nerazzurri', 'Torino Bianconeri', 'Roma Lupi', 'Napoli Azzurro', 'Firenze Viola', 'Bergamo Dea', 'Lazio Aquile'],
  },
  {
    name: 'French First Division', tier: 1, homeNations: ['FRA'],
    clubs: ['Paris Royale', 'Marseille Olympique', 'Lyon Gones', 'Lille Nord', 'Monaco Rouge', 'Rennes Bretagne', 'Nice Aiglons', 'Toulouse Violet'],
  },
  {
    name: 'Dutch First Division', tier: 2, homeNations: ['NED'],
    clubs: ['Amsterdam Godenzonen', 'Rotterdam Zuid', 'Eindhoven Lampen', 'Utrecht Dom', 'Alkmaar Kaas'],
  },
  {
    name: 'Portuguese First Division', tier: 2, homeNations: ['POR'],
    clubs: ['Lisboa Águias', 'Porto Dragões', 'Lisboa Leões', 'Braga Arsenalistas', 'Guimarães Conquistadores'],
  },
  {
    name: 'Belgian First Division', tier: 2, homeNations: ['BEL'],
    clubs: ['Brugge Blauw-Zwart', 'Brussel Paars', 'Genk Smurfen', 'Antwerp Reuzen', 'Gent Buffalos'],
  },
  {
    name: 'Brazilian First Division', tier: 2, homeNations: ['BRA'],
    clubs: ['Rio Rubro-Negro', 'São Paulo Tricolor', 'Palmeiras Verdão', 'Santos Peixe', 'Minas Galo', 'Porto Alegre Imortal'],
  },
  {
    name: 'Argentine First Division', tier: 2, homeNations: ['ARG'],
    clubs: ['Buenos Aires Xeneize', 'Núñez Millonario', 'Avellaneda Rojo', 'La Plata Pincha', 'Rosario Canalla'],
  },
  {
    name: 'Mexican First Division', tier: 2, homeNations: ['MEX'],
    clubs: ['Ciudad Águilas', 'Guadalajara Rebaño', 'Monterrey Rayados', 'Tigres del Norte', 'Cruz del Valle'],
  },
  {
    name: 'American First Division', tier: 2, homeNations: ['USA'],
    clubs: ['Atlanta Five Stripes', 'LA Galactic', 'Seattle Emerald', 'Miami Flamingo', 'Columbus Barrel', 'Austin Verde'],
  },
  {
    name: 'Japanese First Division', tier: 2, homeNations: ['JPN'],
    clubs: ['Yokohama Marinos Blue', 'Kawasaki Dolphins', 'Urawa Diamonds', 'Kashima Ants', 'Osaka Cerezo Rosa'],
  },
  {
    name: 'Turkish First Division', tier: 2, homeNations: [],
    clubs: ['İstanbul Sarı-Kırmızı', 'İstanbul Kanarya', 'Boğaz Kartal', 'Ankara Başkent'],
  },
  {
    name: 'Saudi First Division', tier: 3, homeNations: [],
    clubs: ['Riyadh Crescent', 'Jeddah Union', 'Riyadh Victory', 'Dammam Wave'],
  },
]

export const LEAGUES_BY_NAME: Record<string, League> = Object.fromEntries(
  LEAGUE_DEFS.map((l) => [l.name, l]),
)

// A playable nation's domestic league (undefined = its football lives in the
// generic 'Domestic League' bucket, like most of the world's).
export const DOMESTIC_LEAGUE: Record<string, League> = {}
for (const l of LEAGUE_DEFS) for (const n of l.homeNations) DOMESTIC_LEAGUE[n] = l

export const TIER1_LEAGUES = LEAGUE_DEFS.filter((l) => l.tier === 1)
export const TIER2_LEAGUES = LEAGUE_DEFS.filter((l) => l.tier === 2)
export const GENERIC_LEAGUE = 'Domestic League'

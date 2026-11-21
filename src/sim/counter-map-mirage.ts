// Counter-map entries for the Mirage (ADR 0077): every pair of it with another ball, measured at
// 500 seeds in ruleset 23. The map is in counter-map.ts; its checks in scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * Aimed attacks go for its shimmering copy: the Archer's arrows and the Boomerang's throws pop air
 * while the real Mirage bumps in. Nothing else is fooled: spikes, poison, tentacles, a curse and a
 * heal from bumps all find the real ball, and its heavy bump feeds the Thorns and the Vampire.
 */
export const MIRAGE_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'mirage',
    y: 'brawler',
    intended: 'even',
    reason: 'Plain bumps on both sides; the copy fools no bumper: even.',
  },
  {
    x: 'mirage',
    y: 'speedster',
    intended: 'even',
    reason: 'The Speedster hits by bumping, so the copy never fools it: even.',
  },
  {
    x: 'mirage',
    y: 'vampire',
    intended: 'y',
    level: 'edge',
    reason: 'Its heavy bumps feed the Vampire’s heal, and the copy fools no bumper.',
  },
  {
    x: 'mirage',
    y: 'archer',
    intended: 'x',
    level: 'strong',
    reason: 'Arrows fly at the copy while the real Mirage bumps in from the side.',
  },
  {
    x: 'mirage',
    y: 'storm',
    intended: 'even',
    reason: 'A bolt at the copy pops it, but the next one finds the Mirage: even.',
  },
  {
    x: 'mirage',
    y: 'frost',
    intended: 'even',
    reason: 'The slow comes with a bump, so the copy takes none of it: even.',
  },
  {
    x: 'mirage',
    y: 'thorns',
    intended: 'y',
    level: 'strong',
    reason: 'Its heavy bumps come back off the spikes, and spikes aren’t aimed.',
  },
  {
    x: 'mirage',
    y: 'venom',
    intended: 'y',
    level: 'edge',
    reason: 'Poison comes with a bump, so the copy never takes any of it.',
  },
  {
    x: 'mirage',
    y: 'berserker',
    intended: 'even',
    reason: 'Rage builds from bumps the copy can’t take: even.',
  },
  {
    x: 'mirage',
    y: 'sniper',
    intended: 'even',
    reason: 'One shot pops the copy and the next locks onto the Mirage: even.',
  },
  {
    x: 'mirage',
    y: 'quake',
    intended: 'even',
    reason: 'Shockwaves pop the copy and chip the Mirage alike: even.',
  },
  {
    x: 'mirage',
    y: 'magnet',
    intended: 'even',
    reason: 'The pull drags the real Mirage, not its copy: even.',
  },
  {
    x: 'mirage',
    y: 'ghost',
    intended: 'even',
    reason: 'The Ghost aims nothing, so the copy changes nothing: even.',
  },
  {
    x: 'mirage',
    y: 'necromancer',
    intended: 'even',
    reason: 'The skeleton bites the real Mirage, but its heavy bump pops it: even.',
  },
  {
    x: 'mirage',
    y: 'chrono',
    intended: 'even',
    reason: 'The rewind undoes bumps; the copy fools nothing it does: even.',
  },
  {
    x: 'mirage',
    y: 'titan',
    intended: 'even',
    reason: 'The Titan only bumps; the copy changes nothing: even.',
  },
  {
    x: 'mirage',
    y: 'inferno',
    intended: 'even',
    reason: 'The fire trail is never aimed, so the copy changes nothing: even.',
  },
  {
    x: 'mirage',
    y: 'boomerang',
    intended: 'x',
    level: 'strong',
    reason: 'Its boomerang flies at the copy, so most throws only pop air.',
  },
  {
    x: 'mirage',
    y: 'bomber',
    intended: 'even',
    reason: 'Bombs blow when touched, aimed at nothing: even.',
  },
  {
    x: 'mirage',
    y: 'spartan',
    intended: 'x',
    level: 'edge',
    reason: 'Spears fly at the copy, so the shield alone has to hold it off.',
  },
  {
    x: 'mirage',
    y: 'bloom',
    intended: 'y',
    level: 'edge',
    reason: 'The Bloom regrows between bumps, and nothing it does is aimed.',
  },
  {
    x: 'mirage',
    y: 'hex',
    intended: 'y',
    level: 'strong',
    reason: 'The curse bursts for a share of health, and the Mirage has plenty.',
  },
  {
    x: 'mirage',
    y: 'spider',
    intended: 'even',
    reason: 'Webs on the walls nip the real Mirage; the copy changes nothing: even.',
  },
  {
    x: 'mirage',
    y: 'battery',
    intended: 'even',
    reason: 'The Battery aims nothing, so the copy changes nothing: even.',
  },
  {
    x: 'mirage',
    y: 'slime',
    intended: 'even',
    reason: 'Two halves bump it twice; its heavy bump splits them fast: even.',
  },
  {
    x: 'mirage',
    y: 'balloon',
    intended: 'even',
    reason: 'Two heavy bumpers, and the Balloon shoots nothing: even.',
  },
  {
    x: 'mirage',
    y: 'banshee',
    intended: 'even',
    reason: 'The wail rings all around, copy or not: even.',
  },
  {
    x: 'mirage',
    y: 'kraken',
    intended: 'y',
    level: 'edge',
    reason: 'Tentacles rise where the real Mirage is heading, never at its copy.',
  },
];

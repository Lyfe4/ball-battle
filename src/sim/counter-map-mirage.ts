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
    reason: 'The Brawler only bumps, so the Mirage’s copy fools nothing.',
  },
  {
    x: 'mirage',
    y: 'speedster',
    intended: 'even',
    reason: 'The Speedster hits by bumping, so the Mirage’s copy never fools it.',
  },
  {
    x: 'mirage',
    y: 'vampire',
    intended: 'y',
    level: 'edge',
    reason: 'The Mirage’s heavy bumps heal the Vampire, and its copy fools no bumper.',
  },
  {
    x: 'mirage',
    y: 'archer',
    intended: 'x',
    level: 'strong',
    reason: 'The Archer’s arrows fly at the copy while the real Mirage bumps in.',
  },
  {
    x: 'mirage',
    y: 'storm',
    intended: 'even',
    reason: 'Storm lightning on the copy pops it, but the next strike finds the Mirage.',
  },
  {
    x: 'mirage',
    y: 'frost',
    intended: 'even',
    reason: 'The Frost’s slow comes with a bump, so the Mirage’s copy takes none of it.',
  },
  {
    x: 'mirage',
    y: 'thorns',
    intended: 'y',
    level: 'strong',
    reason:
      'The Mirage’s heavy bumps come back off the Thorns’ spikes, and the copy can’t take those.',
  },
  {
    x: 'mirage',
    y: 'venom',
    intended: 'y',
    level: 'edge',
    reason: 'The Venom’s poison comes with a bump, so the Mirage’s copy never takes it.',
  },
  {
    x: 'mirage',
    y: 'berserker',
    intended: 'even',
    reason: 'The Berserker’s rage comes out in bumps, which the Mirage’s copy can’t take.',
  },
  {
    x: 'mirage',
    y: 'sniper',
    intended: 'even',
    reason: 'One Sniper shot pops the copy, and the next locks onto the Mirage.',
  },
  {
    x: 'mirage',
    y: 'quake',
    intended: 'even',
    reason: 'The Quake’s shockwaves aren’t aimed: they reach the Mirage, copy or not.',
  },
  {
    x: 'mirage',
    y: 'magnet',
    intended: 'even',
    reason: 'The Magnet pulls the real Mirage, never its copy.',
  },
  {
    x: 'mirage',
    y: 'ghost',
    intended: 'even',
    reason: 'The Ghost aims nothing, so the Mirage’s copy changes nothing.',
  },
  {
    x: 'mirage',
    y: 'necromancer',
    intended: 'even',
    reason:
      'The skull bites the real Mirage, and the Mirage bumps far harder than the Necromancer.',
  },
  {
    x: 'mirage',
    y: 'chrono',
    intended: 'even',
    reason: 'The Chrono only bumps, so the Mirage’s copy fools nothing it does.',
  },
  {
    x: 'mirage',
    y: 'titan',
    intended: 'even',
    reason: 'The Titan only bumps, so the Mirage’s copy changes nothing.',
  },
  {
    x: 'mirage',
    y: 'inferno',
    intended: 'even',
    reason: 'The Inferno’s fire is never aimed, so the Mirage’s copy changes nothing.',
  },
  {
    x: 'mirage',
    y: 'boomerang',
    intended: 'x',
    level: 'strong',
    reason: 'The Boomerang throws at the Mirage’s copy, so most throws only pop it.',
  },
  {
    x: 'mirage',
    y: 'bomber',
    intended: 'even',
    reason: 'The Bomber’s bombs aim at nothing, so the Mirage’s copy changes nothing.',
  },
  {
    x: 'mirage',
    y: 'spartan',
    intended: 'x',
    level: 'edge',
    reason: 'The Spartan’s spear flies at the copy, so only its shield holds the Mirage off.',
  },
  {
    x: 'mirage',
    y: 'bloom',
    intended: 'y',
    level: 'edge',
    reason: 'The Bloom regrows between bumps, and nothing it does is aimed at the Mirage’s copy.',
  },
  {
    x: 'mirage',
    y: 'hex',
    intended: 'y',
    level: 'strong',
    reason: 'The Hex’s curse bursts for 21 on the Mirage, and the copy can’t take a curse.',
  },
  {
    x: 'mirage',
    y: 'spider',
    intended: 'even',
    reason: 'The Spider’s webs nip the real Mirage on the walls; the copy changes nothing.',
  },
  {
    x: 'mirage',
    y: 'battery',
    intended: 'even',
    reason: 'The Battery aims nothing, so the Mirage’s copy changes nothing.',
  },
  {
    x: 'mirage',
    y: 'slime',
    intended: 'even',
    reason: 'The Mirage’s heavy bump splits the Slime fast, then both halves bump it.',
  },
  {
    x: 'mirage',
    y: 'balloon',
    intended: 'even',
    reason: 'The Mirage and the Balloon trade heavy bumps, and neither aims a thing.',
  },
  {
    x: 'mirage',
    y: 'banshee',
    intended: 'even',
    reason: 'The Banshee’s wail rings all around, so the Mirage’s copy changes nothing.',
  },
  {
    x: 'mirage',
    y: 'kraken',
    intended: 'y',
    level: 'edge',
    reason: 'The Kraken’s tentacles rise where the real Mirage is heading, never at its copy.',
  },
];

// Counter-map entries for the Kraken (ADR 0075): every pair of it with another ball, measured at
// 500 seeds in ruleset 22. The map is in counter-map.ts; its checks in scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * Its tentacles rise where its enemy is heading, hold it almost still and crush it, more for a
 * bigger ball. A held ball loses its ability: the Vampire can't bump to heal (an edge since its
 * Thirst, ADR 0077), the Spider's anchored
 * enemy never bounces into a web, and the grown Titan takes four tentacles. Standing still to
 * squeeze makes it a target for heavy aimed hits (the Storm, Sniper and Spartan), and the phased
 * Ghost slips the grab.
 */
export const KRAKEN_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'kraken',
    y: 'brawler',
    intended: 'x',
    level: 'edge',
    reason: 'The plain Brawler runs onto its tentacles with nothing to slip them.',
  },
  {
    x: 'kraken',
    y: 'speedster',
    intended: 'y',
    level: 'edge',
    reason: 'Its wall bounces change its line, so the tentacles often rise where it isn’t.',
  },
  {
    x: 'kraken',
    y: 'vampire',
    intended: 'x',
    level: 'edge',
    reason: 'A held Vampire can’t bump to heal, though the crush makes it thirsty after.',
  },
  {
    x: 'kraken',
    y: 'archer',
    intended: 'y',
    level: 'edge',
    reason: 'Arrows keep hitting the anchored Kraken while it squeezes.',
  },
  {
    x: 'kraken',
    y: 'storm',
    intended: 'y',
    level: 'strong',
    reason: 'Anchored to squeeze, it stands still under the lightning.',
  },
  {
    x: 'kraken',
    y: 'frost',
    intended: 'x',
    level: 'edge',
    reason: 'The slow Frost is easy to wrap and crush.',
  },
  {
    x: 'kraken',
    y: 'thorns',
    intended: 'x',
    level: 'edge',
    reason: 'Tentacles crush without a bump, so the spikes never bite.',
  },
  {
    x: 'kraken',
    y: 'venom',
    intended: 'even',
    reason: 'The poison drips while the tentacles crush: even.',
  },
  {
    x: 'kraken',
    y: 'berserker',
    intended: 'even',
    reason: 'One crush is one hit, so it stores only one rage: even.',
  },
  {
    x: 'kraken',
    y: 'sniper',
    intended: 'y',
    level: 'strong',
    reason: 'The anchored Kraken is a still target for the heavy shot.',
  },
  {
    x: 'kraken',
    y: 'quake',
    intended: 'even',
    reason: 'A held Quake makes no wall hits, but the grip is short: even.',
  },
  {
    x: 'kraken',
    y: 'magnet',
    intended: 'even',
    reason: 'The pull and the grab each drag the other off its line: even.',
  },
  {
    x: 'kraken',
    y: 'ghost',
    intended: 'y',
    level: 'strong',
    reason: 'Phased, it slips the grab, and hits the anchored Kraken as it passes.',
  },
  {
    x: 'kraken',
    y: 'necromancer',
    intended: 'x',
    level: 'edge',
    reason: 'The tentacles ignore the skull and wrap the Necromancer itself.',
  },
  {
    x: 'kraken',
    y: 'chrono',
    intended: 'x',
    level: 'edge',
    reason: 'A crush of 12 is under the Chrono’s line of 20, so it never rewinds one.',
  },
  {
    x: 'kraken',
    y: 'titan',
    intended: 'x',
    level: 'strong',
    reason: 'A grown Titan is wrapped by four tentacles and crushed twice as hard.',
  },
  {
    x: 'kraken',
    y: 'inferno',
    intended: 'x',
    level: 'edge',
    reason: 'The slow Inferno is easy to wrap, and its fire barely fights back.',
  },
  {
    x: 'kraken',
    y: 'boomerang',
    intended: 'y',
    level: 'edge',
    reason: 'The boomerang hits the anchored Kraken going out and coming back.',
  },
  {
    x: 'kraken',
    y: 'bomber',
    intended: 'even',
    reason: 'A held Bomber still drops its bombs where it stands: even.',
  },
  {
    x: 'kraken',
    y: 'spartan',
    intended: 'y',
    level: 'strong',
    reason: 'Anchored to squeeze, it takes the spear, and the shield halves the crush.',
  },
  {
    x: 'kraken',
    y: 'bloom',
    intended: 'even',
    reason: 'The crush makes the Bloom wait, but only once a grip: even.',
  },
  {
    x: 'kraken',
    y: 'hex',
    intended: 'even',
    reason: 'The curse and the crush each take a big bite: even.',
  },
  {
    x: 'kraken',
    y: 'spider',
    intended: 'x',
    level: 'strong',
    reason: 'Anchored, it never bounces into a web, and it wraps the Spider like anyone.',
  },
  {
    x: 'kraken',
    y: 'battery',
    intended: 'even',
    reason: 'A crush of 12 is too small for the Battery to store: even.',
  },
  {
    x: 'kraken',
    y: 'slime',
    intended: 'even',
    reason: 'It wraps both halves, but their double bumps even it out.',
  },
];

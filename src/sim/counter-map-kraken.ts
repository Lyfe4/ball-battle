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
    reason: 'The Brawler runs onto the Kraken’s tentacles with nothing to slip them.',
  },
  {
    x: 'kraken',
    y: 'speedster',
    intended: 'y',
    level: 'edge',
    reason: 'The Speedster’s wall bounces change its line, so the Kraken’s tentacles often miss.',
  },
  {
    x: 'kraken',
    y: 'vampire',
    intended: 'x',
    level: 'edge',
    reason: 'A held Vampire can’t bump to heal, and the Kraken’s crush only speeds it up after.',
  },
  {
    x: 'kraken',
    y: 'archer',
    intended: 'y',
    level: 'edge',
    reason: 'Archer arrows keep hitting the Kraken while it anchors to squeeze.',
  },
  {
    x: 'kraken',
    y: 'storm',
    intended: 'y',
    level: 'strong',
    reason: 'The Kraken stands still to squeeze, right under the Storm’s lightning.',
  },
  {
    x: 'kraken',
    y: 'frost',
    intended: 'x',
    level: 'edge',
    reason: 'The slow Frost is easy for the Kraken’s tentacles to wrap.',
  },
  {
    x: 'kraken',
    y: 'thorns',
    intended: 'x',
    level: 'edge',
    reason: 'The Kraken’s tentacles crush without a bump, so the Thorns’ spikes never answer.',
  },
  {
    x: 'kraken',
    y: 'venom',
    intended: 'even',
    reason: 'The Venom poisons with each bump while the Kraken’s tentacles crush.',
  },
  {
    x: 'kraken',
    y: 'berserker',
    intended: 'even',
    reason: 'One Kraken crush is one hit, so it stores the Berserker only one rage.',
  },
  {
    x: 'kraken',
    y: 'sniper',
    intended: 'y',
    level: 'strong',
    reason: 'The anchored Kraken is a still target for the Sniper’s unled shot.',
  },
  {
    x: 'kraken',
    y: 'quake',
    intended: 'even',
    reason: 'A held Quake makes few wall hits, but the Kraken’s grip is short.',
  },
  {
    x: 'kraken',
    y: 'magnet',
    intended: 'even',
    reason: 'The Magnet’s pull and the Kraken’s grab each drag the other off its line.',
  },
  {
    x: 'kraken',
    y: 'ghost',
    intended: 'y',
    level: 'strong',
    reason: 'The phased Ghost slips the tentacles and hits the anchored Kraken as it passes.',
  },
  {
    x: 'kraken',
    y: 'necromancer',
    intended: 'x',
    level: 'edge',
    reason: 'The Kraken’s tentacles skip the skull and wrap the Necromancer itself.',
  },
  {
    x: 'kraken',
    y: 'chrono',
    intended: 'x',
    level: 'edge',
    reason: 'The Kraken’s crush of 12 is under the 20 the Chrono rewinds.',
  },
  {
    x: 'kraken',
    y: 'titan',
    intended: 'x',
    level: 'strong',
    reason: 'The Kraken wraps a grown Titan with four tentacles and crushes it for 24.',
  },
  {
    x: 'kraken',
    y: 'inferno',
    intended: 'x',
    level: 'edge',
    reason: 'The slow Inferno is easy for the Kraken’s tentacles to wrap, and its bump is light.',
  },
  {
    x: 'kraken',
    y: 'boomerang',
    intended: 'y',
    level: 'edge',
    reason: 'The Boomerang’s throw hits the anchored Kraken going out and coming back.',
  },
  {
    x: 'kraken',
    y: 'bomber',
    intended: 'even',
    reason: 'A Bomber held by the Kraken still drops its bombs where it stands.',
  },
  {
    x: 'kraken',
    y: 'spartan',
    intended: 'y',
    level: 'strong',
    reason: 'The anchored Kraken takes the Spartan’s spear, and the shield halves the crush.',
  },
  {
    x: 'kraken',
    y: 'bloom',
    intended: 'even',
    reason: 'The Kraken’s crush shuts the Bloom’s bud, but only once a grip.',
  },
  {
    x: 'kraken',
    y: 'hex',
    intended: 'even',
    reason: 'The Hex’s curse and the Kraken’s crush each take a big bite.',
  },
  {
    x: 'kraken',
    y: 'spider',
    intended: 'x',
    level: 'strong',
    reason:
      'Anchored to squeeze, the Kraken bounces into fewer webs, and wraps the Spider like anyone.',
  },
  {
    x: 'kraken',
    y: 'battery',
    intended: 'even',
    reason: 'The Kraken’s crush of 12 is too small for the Battery to store.',
  },
  {
    x: 'kraken',
    y: 'slime',
    intended: 'even',
    reason: 'The Kraken’s tentacles wrap both Slime halves, and each half still bumps.',
  },
];

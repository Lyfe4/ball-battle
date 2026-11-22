// Counter-map entries for the Hex (ADR 0049): every pair of it with another ball. The map is in
// counter-map.ts; its checks in scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * The Hex's bump curses, and 3 s later the mark bursts for over a quarter of the cursed ball's full
 * health. A big ball takes a big burst, so it beats the sturdy balls (and the Inferno, whose light
 * bumps barely hurt back), and loses to the frail ones that take a small burst and heal or halve
 * it, and to the Ghost, which can't be cursed while phased.
 */
export const HEX_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'hex',
    y: 'brawler',
    intended: 'even',
    reason: 'Each Hex bump curses the Brawler, but the Brawler bumps much harder.',
  },
  {
    x: 'hex',
    y: 'speedster',
    intended: 'x',
    level: 'strong',
    reason: 'The Hex’s curse bursts for 19 on the Speedster, more than a plain bump.',
  },
  {
    x: 'hex',
    y: 'vampire',
    intended: 'y',
    level: 'strong',
    reason: 'A Hex curse bursts for 10 on the Vampire, and one Vampire bump heals that back.',
  },
  {
    x: 'hex',
    y: 'archer',
    intended: 'y',
    level: 'edge',
    reason: 'Archer arrows land from afar, and the Hex’s curse bursts for only 13 on the Archer.',
  },
  {
    x: 'hex',
    y: 'storm',
    intended: 'even',
    reason:
      'The Storm’s lightning can be dodged and the Hex’s curse can’t, but lightning hits for 42.',
  },
  {
    x: 'hex',
    y: 'frost',
    intended: 'x',
    level: 'strong',
    reason: 'The Hex’s curse bursts for 22 on the big Frost, as much as a Frost bump.',
  },
  {
    x: 'hex',
    y: 'thorns',
    intended: 'x',
    level: 'strong',
    reason:
      'The Hex’s curse is no bump, so the Thorns’ spikes never answer it, and it bursts for 22.',
  },
  {
    x: 'hex',
    y: 'venom',
    intended: 'even',
    reason: 'The Venom’s poison and the Hex’s curse both hurt after the bump.',
  },
  {
    x: 'hex',
    y: 'berserker',
    intended: 'x',
    level: 'strong',
    reason: 'The Hex’s curse bursts for 24 on the big Berserker, and stores it just one rage.',
  },
  {
    x: 'hex',
    y: 'sniper',
    intended: 'x',
    level: 'edge',
    reason: 'The Hex’s curse bursts for 21 on the Sniper, and the Hex bumps it between shots.',
  },
  {
    x: 'hex',
    y: 'quake',
    intended: 'even',
    reason: 'The Quake’s small shockwaves chip the Hex; the curse bursts for 19 now and then.',
  },
  {
    x: 'hex',
    y: 'magnet',
    intended: 'even',
    reason: 'The Magnet pulls in the Hex’s cursing bumps, and its own hard bumps hit back.',
  },
  {
    x: 'hex',
    y: 'ghost',
    intended: 'y',
    level: 'strong',
    reason: 'A Ghost pass lays no Hex curse, and a burst while the Ghost is phased misses.',
  },
  {
    x: 'hex',
    y: 'necromancer',
    intended: 'x',
    level: 'edge',
    reason: 'The Hex’s curse bursts for 19 on the Necromancer, more than a skull bite’s 11.',
  },
  {
    x: 'hex',
    y: 'chrono',
    intended: 'even',
    reason: 'The Hex’s curse bursts for 17 on the Chrono, under the 20 it rewinds.',
  },
  {
    x: 'hex',
    y: 'titan',
    intended: 'even',
    reason: 'The Hex’s curse bursts for 21 on the Titan, which grows and bumps harder as it goes.',
  },
  {
    x: 'hex',
    y: 'inferno',
    intended: 'x',
    level: 'edge',
    reason: 'The Hex’s curse bursts for 20 on the Inferno, and the Inferno’s bump is light.',
  },
  {
    x: 'hex',
    y: 'boomerang',
    intended: 'even',
    reason:
      'The boomerang can hit the Hex twice a throw; the curse bursts for 14 on the Boomerang.',
  },
  {
    x: 'hex',
    y: 'bomber',
    intended: 'even',
    reason: 'The Hex’s curse and the Bomber’s blast each land one big hit now and then.',
  },
  {
    x: 'hex',
    y: 'spartan',
    intended: 'y',
    level: 'edge',
    reason: 'The Hex’s curse bursts for only 12 on the Spartan, half that with its shield planted.',
  },
  {
    x: 'hex',
    y: 'bloom',
    intended: 'even',
    reason: 'The Hex’s curse shuts the Bloom’s bud, but bursts for only 14 on it.',
  },
  {
    x: 'hex',
    y: 'spider',
    intended: 'x',
    level: 'edge',
    reason: 'The Hex’s curse bursts for 19 on the Spider, more than its webs nip back.',
  },
];

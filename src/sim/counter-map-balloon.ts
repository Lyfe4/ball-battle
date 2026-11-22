// Counter-map entries for the Balloon (ADR 0075): every pair of it with another ball, measured at
// 500 seeds in ruleset 22. The map is in counter-map.ts; its checks in scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * It floats: fire, bombs, shockwaves and lightning land at half, but every shot hits it harder. So
 * it beats the balls that win through the court (the Inferno, Bomber, Storm and Quake) and loses
 * to the shooters (the Archer, Sniper and Boomerang). Bumps, curses and heals meet it as anyone.
 */
export const BALLOON_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'balloon',
    y: 'brawler',
    intended: 'even',
    reason: 'The Balloon and the Brawler just trade heavy bumps; there’s nothing to float over.',
  },
  {
    x: 'balloon',
    y: 'speedster',
    intended: 'x',
    level: 'edge',
    reason:
      'The Balloon bumps for 24 every time; the Speedster needs wall bounces to hit that hard.',
  },
  {
    x: 'balloon',
    y: 'vampire',
    intended: 'y',
    level: 'edge',
    reason: 'Every bump heals the Vampire, and bumps are all the Balloon has.',
  },
  {
    x: 'balloon',
    y: 'archer',
    intended: 'y',
    level: 'strong',
    reason: 'Every Archer arrow hits the Balloon for 140%, from across the court.',
  },
  {
    x: 'balloon',
    y: 'storm',
    intended: 'x',
    level: 'strong',
    reason: 'The Storm’s lightning lands at 55% on the Balloon, and the Storm’s own bump is light.',
  },
  {
    x: 'balloon',
    y: 'frost',
    intended: 'even',
    reason: 'The Frost’s bumps slow the Balloon, and floating does nothing against bumps.',
  },
  {
    x: 'balloon',
    y: 'thorns',
    intended: 'y',
    level: 'edge',
    reason: 'Each of the Balloon’s heavy bumps hurts it back on the Thorns’ spikes.',
  },
  {
    x: 'balloon',
    y: 'venom',
    intended: 'even',
    reason: 'The Venom’s poison lands whole on the Balloon: only area hits float under it.',
  },
  {
    x: 'balloon',
    y: 'berserker',
    intended: 'even',
    reason:
      'The Balloon’s bumps hit harder, but each one feeds the Berserker’s rage for its next bump.',
  },
  {
    x: 'balloon',
    y: 'sniper',
    intended: 'y',
    level: 'strong',
    reason: 'The Sniper’s heavy shot hits the Balloon for 140%, one every 2 s.',
  },
  {
    x: 'balloon',
    y: 'quake',
    intended: 'x',
    level: 'strong',
    reason: 'The Quake’s shockwaves pass under the Balloon at 55%, and the Quake’s bump is light.',
  },
  {
    x: 'balloon',
    y: 'magnet',
    intended: 'even',
    reason: 'The Magnet pulls the Balloon into bumps, and both bump about as hard.',
  },
  {
    x: 'balloon',
    y: 'ghost',
    intended: 'even',
    reason: 'The phased Ghost slips the Balloon’s bumps and hits it for 12 as it passes through.',
  },
  {
    x: 'balloon',
    y: 'necromancer',
    intended: 'even',
    reason: 'The Necromancer’s skulls bite the Balloon whole: only area hits float under it.',
  },
  {
    x: 'balloon',
    y: 'chrono',
    intended: 'even',
    reason: 'The Chrono never rewinds bumps, and bumps are all the Balloon has.',
  },
  {
    x: 'balloon',
    y: 'titan',
    intended: 'even',
    reason:
      'The Titan grows and bumps harder as it goes; the Balloon’s float does nothing to bumps.',
  },
  {
    x: 'balloon',
    y: 'inferno',
    intended: 'x',
    level: 'strong',
    reason: 'The Inferno’s fire burns the Balloon at 55%, and the Inferno’s bump is weak.',
  },
  {
    x: 'balloon',
    y: 'boomerang',
    intended: 'y',
    level: 'strong',
    reason: 'The Boomerang’s throw hits the Balloon for 140%, going out and again coming back.',
  },
  {
    x: 'balloon',
    y: 'bomber',
    intended: 'x',
    level: 'strong',
    reason: 'The Bomber’s blasts land at 55% on the Balloon, and the Bomber’s bump is light.',
  },
  {
    x: 'balloon',
    y: 'spartan',
    intended: 'y',
    level: 'edge',
    reason:
      'The Spartan’s spear is a shot, which hits the Balloon harder, and the shield halves bumps.',
  },
  {
    x: 'balloon',
    y: 'bloom',
    intended: 'y',
    level: 'edge',
    reason:
      'The Bloom regrows whenever the Balloon leaves it alone for 2 s; the Balloon only bumps.',
  },
  {
    x: 'balloon',
    y: 'hex',
    intended: 'y',
    level: 'edge',
    reason:
      'The Hex’s curse takes 27% of the Balloon’s full health, so its big health doesn’t help.',
  },
  {
    x: 'balloon',
    y: 'spider',
    intended: 'even',
    reason: 'The Spider’s webs slow the Balloon on the walls, and the Balloon bumps harder.',
  },
  {
    x: 'balloon',
    y: 'battery',
    intended: 'x',
    level: 'edge',
    reason:
      'The Battery stores no bumps, so it meets the Balloon as a plain bumper with less health.',
  },
  {
    x: 'balloon',
    y: 'slime',
    intended: 'even',
    reason: 'The Balloon’s heavy bumps split the Slime, and each half bumps back for 85%.',
  },
  {
    x: 'balloon',
    y: 'banshee',
    intended: 'x',
    level: 'edge',
    reason: 'The wail skips the Balloon’s float, but the Banshee bumps for 4 to the Balloon’s 24.',
  },
  {
    x: 'balloon',
    y: 'kraken',
    intended: 'y',
    level: 'edge',
    reason: 'The Kraken’s crush isn’t an area hit, so it lands whole on the Balloon.',
  },
];

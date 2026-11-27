// Counter-map entries for the Mole (prototype): every pair of it with another ball, labelled
// from its 500-seed `pnpm balance --ball mole` run by the one rule (ADR 0073).
import type { CounterEntry } from './counter-map.ts';

/**
 * It digs under its nearest enemy (untouchable while under) and bursts up beneath it a moment
 * later: a ball that is slow, planted or anchored is still there; one that keeps moving is gone.
 */
export const MOLE_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'mole',
    y: 'brawler',
    intended: 'even',
    reason:
      'The Brawler’s plain bump meets the Mole’s bump and burst: a standard ball that keeps moving dodges most bursts.',
  },
  {
    x: 'mole',
    y: 'speedster',
    intended: 'y',
    level: 'strong',
    reason:
      'The Speedster keeps moving fast, so it is gone before the Mole bursts up, and its bump grows.',
  },
  {
    x: 'mole',
    y: 'vampire',
    intended: 'x',
    level: 'strong',
    reason:
      'The Vampire heals only off bumps, and a burst from below is no bump: its small health can’t win it back.',
  },
  {
    x: 'mole',
    y: 'archer',
    intended: 'y',
    level: 'edge',
    reason:
      'The Archer’s arrows land on the Mole whenever it is up, and the Archer keeps moving away.',
  },
  {
    x: 'mole',
    y: 'storm',
    intended: 'even',
    reason:
      'Lightning passes over the dug-in Mole; the Storm moves on like any ball, so bursts land about as often.',
  },
  {
    x: 'mole',
    y: 'frost',
    intended: 'even',
    reason:
      'The Frost is a little slower, so bursts catch it more, but its hits slow the Mole too.',
  },
  {
    x: 'mole',
    y: 'thorns',
    intended: 'even',
    reason: 'The Thorns’ spikes punish the Mole’s bumps, while the burst from below skips them.',
  },
  {
    x: 'mole',
    y: 'venom',
    intended: 'even',
    reason: 'Poison stops while the Mole is underground, and the Venom keeps moving out of bursts.',
  },
  {
    x: 'mole',
    y: 'berserker',
    intended: 'even',
    reason:
      'The Berserker hits harder as it is hurt; the Mole’s bursts land as on any moving ball.',
  },
  {
    x: 'mole',
    y: 'sniper',
    intended: 'even',
    reason:
      'The Sniper’s shots pass through the dug-in Mole, and it hits hard whenever the Mole is up.',
  },
  {
    x: 'mole',
    y: 'quake',
    intended: 'y',
    level: 'strong',
    reason:
      'The Quake’s wall shockwaves strike the Mole as it surfaces near the walls, and it keeps bouncing away from bursts.',
  },
  {
    x: 'mole',
    y: 'magnet',
    intended: 'even',
    reason:
      'The Magnet’s pull is wasted on the dug-in Mole; its own bump lands when the Mole is up.',
  },
  {
    x: 'mole',
    y: 'ghost',
    intended: 'even',
    reason:
      'The Ghost phases through bursts and bumps alike, and neither can touch the other half the time.',
  },
  {
    x: 'mole',
    y: 'necromancer',
    intended: 'even',
    reason:
      'The Necromancer’s skulls draw the Mole’s digs, so its bursts land on skulls, not on the Necromancer.',
  },
  {
    x: 'mole',
    y: 'chrono',
    intended: 'even',
    reason: 'The Chrono rewinds the damage a burst did; each side lands about as often.',
  },
  {
    x: 'mole',
    y: 'titan',
    intended: 'x',
    level: 'strong',
    reason:
      'The grown Titan is wide: it can’t get its whole body out of the Mole’s burst before it goes off.',
  },
  {
    x: 'mole',
    y: 'inferno',
    intended: 'even',
    reason:
      'The Inferno’s burning patches pass over the dug-in Mole; it moves on as often as it is caught.',
  },
  {
    x: 'mole',
    y: 'boomerang',
    intended: 'x',
    level: 'edge',
    reason: 'The boomerang flies through the dug-in Mole, and the Mole bursts up while it is out.',
  },
  {
    x: 'mole',
    y: 'bomber',
    intended: 'y',
    level: 'edge',
    reason: 'The Mole surfaces beside the Bomber’s bombs and is caught in their blasts.',
  },
  {
    x: 'mole',
    y: 'spartan',
    intended: 'x',
    level: 'strong',
    reason: 'The Spartan plants its shield and slows down: the Mole bursts up under it from below.',
  },
  {
    x: 'mole',
    y: 'bloom',
    intended: 'even',
    reason: 'The Bloom regrows while the Mole is underground, and each burst makes it wait again.',
  },
  {
    x: 'mole',
    y: 'hex',
    intended: 'x',
    level: 'strong',
    reason:
      'The Hex curses with its bump, which can’t reach the dug-in Mole, while the bursts land from below.',
  },
  {
    x: 'mole',
    y: 'spider',
    intended: 'even',
    reason: 'The Spider’s webs sit on the walls; the Mole’s bursts land on it as on any ball.',
  },
  {
    x: 'mole',
    y: 'battery',
    intended: 'y',
    level: 'strong',
    reason:
      'The fast Battery keeps moving out of every burst, and bumps the Mole hard when it is up.',
  },
  {
    x: 'mole',
    y: 'slime',
    intended: 'even',
    reason: 'The Slime’s halves are small and quick: bursts miss them as often as they land.',
  },
  {
    x: 'mole',
    y: 'balloon',
    intended: 'y',
    level: 'strong',
    reason: 'The Balloon floats: the Mole’s burst is an area hit, which lands at half on it.',
  },
  {
    x: 'mole',
    y: 'banshee',
    intended: 'y',
    level: 'strong',
    reason:
      'The Banshee’s wail reaches the Mole underground and all around it, and the Mole digs right up to it.',
  },
  {
    x: 'mole',
    y: 'kraken',
    intended: 'x',
    level: 'strong',
    reason:
      'The Kraken’s tentacles miss the dug-in Mole, and an anchored Kraken cannot leave its burst.',
  },
  {
    x: 'mole',
    y: 'mirage',
    intended: 'even',
    reason:
      'The Mole digs at the Mirage’s copy as often as at the Mirage, so bursts land as often as they miss.',
  },
  {
    x: 'mole',
    y: 'jouster',
    intended: 'y',
    level: 'strong',
    reason: 'The Mole always comes up heading at the Jouster, so it meets the lance head-on.',
  },
];

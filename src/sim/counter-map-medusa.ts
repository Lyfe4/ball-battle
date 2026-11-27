// Counter-map entries for the Medusa (prototype): every pair of her with another ball, labelled
// from her 500-seed `pnpm balance --ball medusa` run by the one rule (ADR 0073).
import type { CounterEntry } from './counter-map.ts';

/**
 * Her glare turns the first ball in her gaze to stone, and her bump on stone shatters it. Balls that
 * leave her gaze before the glare, hit back off her shatter or show a copy first are her counters.
 */
export const MEDUSA_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'medusa',
    y: 'brawler',
    intended: 'even',
    reason:
      'The Brawler’s plain 26 bump out-trades her 12.5, and a shatter only now and then makes it up.',
  },
  {
    x: 'medusa',
    y: 'speedster',
    intended: 'y',
    level: 'edge',
    reason:
      'The Speedster crosses her gaze before the glare lands, and its stacks carry it out of reach.',
  },
  {
    x: 'medusa',
    y: 'vampire',
    intended: 'x',
    level: 'strong',
    reason:
      'A stoned Vampire can’t bump to heal, and one shatter takes more than its bites give back.',
  },
  {
    x: 'medusa',
    y: 'archer',
    intended: 'even',
    reason: 'The Archer keeps away, and a stoned ball far off walks away before she reaches it.',
  },
  {
    x: 'medusa',
    y: 'storm',
    intended: 'even',
    reason:
      'The Storm’s strikes land on her as she closes on stone; her shatters land on it in turn.',
  },
  {
    x: 'medusa',
    y: 'frost',
    intended: 'even',
    reason:
      'The Frost slows her on the way to a stoned ball; it is slow enough to stay in her gaze.',
  },
  {
    x: 'medusa',
    y: 'thorns',
    intended: 'y',
    level: 'edge',
    reason: 'Her shatter is her one big bump, and the Thorns’ spikes send a share of it back.',
  },
  {
    x: 'medusa',
    y: 'venom',
    intended: 'even',
    reason: 'The Venom’s poison keeps ticking while she waits for her gaze.',
  },
  {
    x: 'medusa',
    y: 'berserker',
    intended: 'even',
    reason: 'A shatter is big damage on the Berserker, and big damage makes it stronger.',
  },
  {
    x: 'medusa',
    y: 'sniper',
    intended: 'even',
    reason: 'The Sniper’s shots hit her as she closes; a stoned Sniper is shattered in turn.',
  },
  {
    x: 'medusa',
    y: 'quake',
    intended: 'even',
    reason: 'The Quake’s wall shocks and her shatters trade about evenly.',
  },
  {
    x: 'medusa',
    y: 'magnet',
    intended: 'even',
    reason:
      'The Magnet pulls her in, but a stoned Magnet is right in front of her for the shatter.',
  },
  {
    x: 'medusa',
    y: 'ghost',
    intended: 'even',
    reason: 'Her gaze passes through the phased Ghost; solid, it is stoned like anyone.',
  },
  {
    x: 'medusa',
    y: 'necromancer',
    intended: 'even',
    reason: 'The skull draws no glare; the Necromancer itself is stoned and shattered like anyone.',
  },
  {
    x: 'medusa',
    y: 'chrono',
    intended: 'y',
    level: 'edge',
    reason: 'The Chrono rewinds after a shatter, so her biggest hit is undone.',
  },
  {
    x: 'medusa',
    y: 'titan',
    intended: 'even',
    reason: 'The grown Titan has the health to take a shatter and bumps back harder.',
  },
  {
    x: 'medusa',
    y: 'inferno',
    intended: 'even',
    reason: 'The Inferno’s burns and her shatters trade about evenly.',
  },
  {
    x: 'medusa',
    y: 'boomerang',
    intended: 'even',
    reason: 'The boomerang hits her as she closes on stone; even.',
  },
  {
    x: 'medusa',
    y: 'bomber',
    intended: 'even',
    reason: 'A stoned Bomber still drops its bombs where she must come to shatter it.',
  },
  {
    x: 'medusa',
    y: 'spartan',
    intended: 'even',
    reason: 'The Spartan’s shield takes most of a shatter that lands on its front.',
  },
  {
    x: 'medusa',
    y: 'bloom',
    intended: 'x',
    level: 'edge',
    reason:
      'A stoned Bloom can’t move off its petals’ ground, and a shatter is a big share of its health.',
  },
  {
    x: 'medusa',
    y: 'hex',
    intended: 'even',
    reason: 'The Hex’s curse and her shatter are both bursts; even.',
  },
  {
    x: 'medusa',
    y: 'spider',
    intended: 'x',
    level: 'edge',
    reason: 'A stoned Spider makes no webs at walls, and it is shattered like anyone.',
  },
  {
    x: 'medusa',
    y: 'battery',
    intended: 'even',
    reason: 'The Battery is fast enough to leave her gaze sometimes, not often.',
  },
  {
    x: 'medusa',
    y: 'slime',
    intended: 'y',
    level: 'strong',
    reason:
      'The Slime’s halves are smaller targets in her gaze, and a shatter on one half leaves the other.',
  },
  {
    x: 'medusa',
    y: 'balloon',
    intended: 'even',
    reason: 'The floating Balloon is stoned and shattered like anyone; its shots trade evenly.',
  },
  {
    x: 'medusa',
    y: 'banshee',
    intended: 'even',
    reason: 'The Banshee’s wail and her shatter trade about evenly in short fights.',
  },
  {
    x: 'medusa',
    y: 'kraken',
    intended: 'even',
    reason: 'The Kraken holds her away from a stoned ball; a held ball is easy to stone.',
  },
  {
    x: 'medusa',
    y: 'mirage',
    intended: 'y',
    level: 'edge',
    reason: 'The Mirage’s copy, nearer in her gaze, takes the glare and nothing turns to stone.',
  },
  {
    x: 'medusa',
    y: 'jouster',
    intended: 'y',
    level: 'edge',
    reason:
      'The charging Jouster runs out of her gaze before the glare, and its lance hits her hard.',
  },
];

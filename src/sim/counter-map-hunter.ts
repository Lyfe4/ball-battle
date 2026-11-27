// Counter-map entries for the Hunter (prototype): every pair of it with another ball, labelled
// from its 500-seed `pnpm balance --ball hunter` run by the one rule (ADR 0073).
import type { CounterEntry } from './counter-map.ts';

/**
 * Its bump lands harder the slower its prey is moving and softer on fast prey; its snares hold a
 * ball that runs into one. Slow prey (the Frost, the shielded Spartan) takes its hardest bumps;
 * fast prey (the Speedster, the charging Jouster) takes its softest.
 */
export const HUNTER_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'hunter',
    y: 'brawler',
    intended: 'even',
    reason: 'The Brawler’s 26 bump meets the Hunter’s 25 at the same speed: plain against plain.',
  },
  {
    x: 'hunter',
    y: 'speedster',
    intended: 'y',
    level: 'strong',
    reason: 'The Speedster is too fast to hit hard: the Hunter’s bump lands at three quarters.',
  },
  {
    x: 'hunter',
    y: 'vampire',
    intended: 'even',
    reason: 'The Hunter’s snares hold the Vampire, but its bites heal back what they cost.',
  },
  {
    x: 'hunter',
    y: 'archer',
    intended: 'even',
    reason: 'The Archer keeps away, and the Hunter’s snares rarely catch a ball that stays away.',
  },
  {
    x: 'hunter',
    y: 'storm',
    intended: 'even',
    reason: 'The Storm’s strikes catch a snaring Hunter; held, the Storm takes its hardest bumps.',
  },
  {
    x: 'hunter',
    y: 'frost',
    intended: 'x',
    level: 'strong',
    reason: 'The Frost is the slowest ball: the Hunter’s bump lands a quarter harder on it.',
  },
  {
    x: 'hunter',
    y: 'thorns',
    intended: 'even',
    reason: 'The Hunter’s heavy bumps on the Thorns come back off its spikes.',
  },
  {
    x: 'hunter',
    y: 'venom',
    intended: 'y',
    level: 'edge',
    reason: 'The Venom’s poison keeps ticking while the Hunter waits for slow prey.',
  },
  {
    x: 'hunter',
    y: 'berserker',
    intended: 'even',
    reason: 'The Berserker’s rage grows with every hit, and the Hunter’s bumps feed it.',
  },
  {
    x: 'hunter',
    y: 'sniper',
    intended: 'even',
    reason: 'The Sniper shoots from afar; the Hunter’s snares catch it only now and then.',
  },
  {
    x: 'hunter',
    y: 'quake',
    intended: 'even',
    reason: 'The Quake’s shockwaves chip the Hunter; a snared Quake takes its full bump.',
  },
  {
    x: 'hunter',
    y: 'magnet',
    intended: 'even',
    reason: 'The Magnet pulls the Hunter in at full speed: its bump lands as it is.',
  },
  {
    x: 'hunter',
    y: 'ghost',
    intended: 'even',
    reason: 'The Ghost phases over the Hunter’s snares, but its fades leave it to plain bumps.',
  },
  {
    x: 'hunter',
    y: 'necromancer',
    intended: 'even',
    reason: 'The Hunter’s bumps crush skulls, and the Necromancer keeps raising more.',
  },
  {
    x: 'hunter',
    y: 'chrono',
    intended: 'even',
    reason: 'The Chrono rewinds what the Hunter’s heavy bumps take.',
  },
  {
    x: 'hunter',
    y: 'titan',
    intended: 'even',
    reason: 'The Titan is big and easy to reach, and its weight answers the Hunter’s bumps.',
  },
  {
    x: 'hunter',
    y: 'inferno',
    intended: 'even',
    reason: 'The Inferno’s fire burns a Hunter lingering by its snares.',
  },
  {
    x: 'hunter',
    y: 'boomerang',
    intended: 'even',
    reason: 'The Boomerang hits from afar both ways; the Hunter needs it close and slow.',
  },
  {
    x: 'hunter',
    y: 'bomber',
    intended: 'y',
    level: 'edge',
    reason: 'The Bomber’s bombs blow up around the Hunter as it lays its snares.',
  },
  {
    x: 'hunter',
    y: 'spartan',
    intended: 'x',
    level: 'strong',
    reason: 'The Spartan slows behind its raised shield: the Hunter’s bump lands hardest then.',
  },
  {
    x: 'hunter',
    y: 'bloom',
    intended: 'even',
    reason: 'The Bloom regrows what the Hunter’s bumps take.',
  },
  {
    x: 'hunter',
    y: 'hex',
    intended: 'even',
    reason: 'The Hex’s curse turns the Hunter’s heavy bumps against it.',
  },
  {
    x: 'hunter',
    y: 'spider',
    intended: 'y',
    level: 'edge',
    reason: 'The Spider’s webs slow the Hunter, and the Spider itself stays fast prey.',
  },
  {
    x: 'hunter',
    y: 'battery',
    intended: 'y',
    level: 'edge',
    reason: 'The Battery is fast and stores every heavy Hunter bump for its own.',
  },
  {
    x: 'hunter',
    y: 'slime',
    intended: 'y',
    level: 'edge',
    reason: 'The Slime’s quick halves are fast prey: the Hunter’s bumps land soft on them.',
  },
  {
    x: 'hunter',
    y: 'balloon',
    intended: 'even',
    reason: 'The Balloon’s bumps land as they are, and the Hunter’s land as they are on it.',
  },
  {
    x: 'hunter',
    y: 'banshee',
    intended: 'y',
    level: 'edge',
    reason: 'The Banshee’s wail lands from afar, where the Hunter’s snares never reach.',
  },
  {
    x: 'hunter',
    y: 'kraken',
    intended: 'even',
    reason: 'The Kraken anchors to squeeze, slow prey for the Hunter, but its tentacles hold back.',
  },
  {
    x: 'hunter',
    y: 'mirage',
    intended: 'even',
    reason: 'The Mirage’s copy draws the Hunter’s bumps away from it.',
  },
  {
    x: 'hunter',
    y: 'jouster',
    intended: 'y',
    level: 'strong',
    reason: 'The Jouster charges too fast to hit hard, and its lance hits the Hunter triple.',
  },
];

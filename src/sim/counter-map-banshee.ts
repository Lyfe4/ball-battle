// Counter-map entries for the Banshee (ADR 0075): every pair of it with another ball, measured at
// 500 seeds in ruleset 22. The map is in counter-map.ts; its checks in scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * Its wail hits all around it and nothing blocks it. So it beats the balls whose defence is not
 * being touched (the phased Ghost) and the frail Vampire, which heals only from bumps; and loses to
 * the Chrono, which rewinds one big hit, to shooters outside its ring and to the grown Titan.
 */
export const BANSHEE_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'banshee',
    y: 'brawler',
    intended: 'even',
    reason: 'The wail lands every time, and the Brawler’s heavy bumps answer it: even.',
  },
  {
    x: 'banshee',
    y: 'speedster',
    intended: 'even',
    reason: 'The Speedster rushes in and out of the ring: even.',
  },
  {
    x: 'banshee',
    y: 'vampire',
    intended: 'x',
    level: 'strong',
    reason: 'The wail hits without a touch, so the frail Vampire has nothing to drink.',
  },
  {
    x: 'banshee',
    y: 'archer',
    intended: 'y',
    level: 'strong',
    reason: 'Arrows come from outside its ring, and it has little health.',
  },
  {
    x: 'banshee',
    y: 'storm',
    intended: 'even',
    reason: 'Lightning and the wail trade big hits from afar: even.',
  },
  {
    x: 'banshee',
    y: 'frost',
    intended: 'even',
    reason: 'The sturdy Frost soaks up the wails: even.',
  },
  {
    x: 'banshee',
    y: 'thorns',
    intended: 'even',
    reason: 'The wail never touches the spikes, but the Thorns’ big health soaks it up: even.',
  },
  {
    x: 'banshee',
    y: 'venom',
    intended: 'even',
    reason: 'The wail and the poison both hurt without a bump: even.',
  },
  {
    x: 'banshee',
    y: 'berserker',
    intended: 'y',
    level: 'edge',
    reason: 'Every wail builds rage, and its weak bump can’t stop the bump that lets it out.',
  },
  {
    x: 'banshee',
    y: 'sniper',
    intended: 'y',
    level: 'edge',
    reason: 'The heavy shot comes from outside the ring, and it has little health.',
  },
  {
    x: 'banshee',
    y: 'quake',
    intended: 'even',
    reason: 'The wail and the shockwaves both hit all around: even.',
  },
  {
    x: 'banshee',
    y: 'magnet',
    intended: 'even',
    reason: 'The pull drags it in close, where the wail lands anyway: even.',
  },
  {
    x: 'banshee',
    y: 'ghost',
    intended: 'x',
    level: 'strong',
    reason: 'Phasing slips every bump, but not the wail: nothing blocks it.',
  },
  {
    x: 'banshee',
    y: 'necromancer',
    intended: 'even',
    reason: 'Skulls bite while the wail hits the Necromancer itself: even.',
  },
  {
    x: 'banshee',
    y: 'chrono',
    intended: 'y',
    level: 'strong',
    reason: 'One big wail is just what the Chrono rewinds.',
  },
  {
    x: 'banshee',
    y: 'titan',
    intended: 'y',
    level: 'strong',
    reason: 'The grown Titan has the health to take the wails, and bumps hard back.',
  },
  {
    x: 'banshee',
    y: 'inferno',
    intended: 'even',
    reason: 'Fire and the wail both hurt without a bump: even.',
  },
  {
    x: 'banshee',
    y: 'boomerang',
    intended: 'y',
    level: 'edge',
    reason: 'The boomerang hits it from outside the ring, twice a throw.',
  },
  {
    x: 'banshee',
    y: 'bomber',
    intended: 'even',
    reason: 'Bombs and wails trade big hits: even.',
  },
  {
    x: 'banshee',
    y: 'spartan',
    intended: 'even',
    reason: 'The wail goes through the shield, and the spear comes back at it: even.',
  },
  {
    x: 'banshee',
    y: 'bloom',
    intended: 'even',
    reason: 'Each wail makes the Bloom wait, but it wails only every few seconds: even.',
  },
  {
    x: 'banshee',
    y: 'hex',
    intended: 'even',
    reason: 'The curse takes its share and the wail its own: even.',
  },
  {
    x: 'banshee',
    y: 'spider',
    intended: 'x',
    level: 'edge',
    reason: 'The wail reaches the Spider anywhere, and webs barely slow what it does.',
  },
  {
    x: 'banshee',
    y: 'battery',
    intended: 'even',
    reason: 'Nothing blocks the wail, so the Battery stores none of it: even.',
  },
  {
    x: 'banshee',
    y: 'slime',
    intended: 'y',
    level: 'edge',
    reason: 'Its weak bump splits the Slime late, and the halves’ double bumps win.',
  },
  {
    x: 'banshee',
    y: 'kraken',
    intended: 'even',
    reason: 'The wail reaches the Kraken while it anchors to squeeze: even.',
  },
];

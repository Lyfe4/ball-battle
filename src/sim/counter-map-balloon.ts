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
    reason: 'Two heavy bumpers, with nothing to float over or shoot: even.',
  },
  {
    x: 'balloon',
    y: 'speedster',
    intended: 'x',
    level: 'edge',
    reason: 'Its big health and heavy bumps outlast the Speedster’s rushes.',
  },
  {
    x: 'balloon',
    y: 'vampire',
    intended: 'y',
    level: 'edge',
    reason: 'Bumps are all either has, and the Vampire heals from every one.',
  },
  {
    x: 'balloon',
    y: 'archer',
    intended: 'y',
    level: 'strong',
    reason: 'Every arrow hits it harder, from out of reach.',
  },
  {
    x: 'balloon',
    y: 'storm',
    intended: 'x',
    level: 'strong',
    reason: 'Lightning lands at half on it, and the Storm’s light bumps can’t make up the rest.',
  },
  {
    x: 'balloon',
    y: 'frost',
    intended: 'even',
    reason: 'Bump for bump with the sturdy Frost; floating changes nothing here: even.',
  },
  {
    x: 'balloon',
    y: 'thorns',
    intended: 'y',
    level: 'edge',
    reason: 'Its heavy bumps feed the spikes, and floating doesn’t lift it off them.',
  },
  {
    x: 'balloon',
    y: 'venom',
    intended: 'even',
    reason: 'Poison lands as it is, and its big health holds out against the drips: even.',
  },
  {
    x: 'balloon',
    y: 'berserker',
    intended: 'even',
    reason: 'Each heavy bump it lands adds rage, but its big health holds out: even.',
  },
  {
    x: 'balloon',
    y: 'sniper',
    intended: 'y',
    level: 'strong',
    reason: 'A heavy shot hits it harder still: the Sniper’s lock-on pops it.',
  },
  {
    x: 'balloon',
    y: 'quake',
    intended: 'x',
    level: 'strong',
    reason: 'Shockwaves land at half on it, and the Quake lives on them.',
  },
  {
    x: 'balloon',
    y: 'magnet',
    intended: 'even',
    reason: 'Pulled in or not, it bumps as hard as the Magnet: even.',
  },
  {
    x: 'balloon',
    y: 'ghost',
    intended: 'even',
    reason: 'Phasing dodges its bumps for a while; its big health evens it out.',
  },
  {
    x: 'balloon',
    y: 'necromancer',
    intended: 'even',
    reason: 'Skulls bite it as anyone, and its heavy bumps break them: even.',
  },
  {
    x: 'balloon',
    y: 'chrono',
    intended: 'even',
    reason: 'The Chrono rewinds one heavy bump, but the Balloon keeps landing them: even.',
  },
  {
    x: 'balloon',
    y: 'titan',
    intended: 'even',
    reason: 'Bump for bump with the growing Titan; neither floats nor shoots: even.',
  },
  {
    x: 'balloon',
    y: 'inferno',
    intended: 'x',
    level: 'strong',
    reason: 'Fire burns it at half, and the Inferno has little else.',
  },
  {
    x: 'balloon',
    y: 'boomerang',
    intended: 'y',
    level: 'strong',
    reason: 'The boomerang hits it harder going out, and again coming back.',
  },
  {
    x: 'balloon',
    y: 'bomber',
    intended: 'x',
    level: 'strong',
    reason: 'Bombs blow at half on it, and the Bomber’s light bumps can’t make up the rest.',
  },
  {
    x: 'balloon',
    y: 'spartan',
    intended: 'y',
    level: 'edge',
    reason: 'The spear is a shot, so it hits harder, and the shield halves its bumps.',
  },
  {
    x: 'balloon',
    y: 'bloom',
    intended: 'y',
    level: 'edge',
    reason: 'The Bloom regrows between its bumps, and floating doesn’t stop that.',
  },
  {
    x: 'balloon',
    y: 'hex',
    intended: 'y',
    level: 'edge',
    reason: 'The curse takes a share of its health, so its big health doesn’t help.',
  },
  {
    x: 'balloon',
    y: 'spider',
    intended: 'even',
    reason: 'Webs slow it on the walls like anyone, and its bumps hit back: even.',
  },
  {
    x: 'balloon',
    y: 'battery',
    intended: 'x',
    level: 'edge',
    reason: 'Bumps aren’t stored, so the Battery meets it as a plain bumper with less health.',
  },
  {
    x: 'balloon',
    y: 'slime',
    intended: 'even',
    reason: 'Its heavy bumps split the Slime as well as any: even.',
  },
  {
    x: 'balloon',
    y: 'banshee',
    intended: 'x',
    level: 'edge',
    reason: 'Nothing stops the wail, but its heavy bumps outweigh the Banshee’s weak ones.',
  },
  {
    x: 'balloon',
    y: 'kraken',
    intended: 'y',
    level: 'edge',
    reason: 'Tentacles aren’t an area hit: the crush lands whole on it.',
  },
];

// Counter-map entries for the Pirate (prototype): every pair of it with another ball, labelled from
// its 500-seed `pnpm balance --ball pirate` run (setting s2) by the one rule (ADR 0073).
import type { CounterEntry } from './counter-map.ts';

/**
 * It fires cannonballs only straight out of its sides, at an enemy abeam. Balls that sit still or
 * linger beside it (the Bloom, the Chrono, the floating Balloon) are shot; the Mirage's copy draws
 * its broadsides, and the Slime's two halves leave one free to bump it.
 */
export const PIRATE_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'pirate',
    y: 'brawler',
    intended: 'x',
    level: 'edge',
    reason:
      'The Brawler meets it bump for bump, and between bumps the Pirate shoots it as it sails past.',
  },
  {
    x: 'pirate',
    y: 'speedster',
    intended: 'even',
    reason:
      'The Speedster comes in fast and straight, mostly head-on, but its wall bounces bring it alongside too.',
  },
  {
    x: 'pirate',
    y: 'vampire',
    intended: 'even',
    reason:
      'The Vampire heals off its bumps, but cannonballs from the side are hits it never bites back.',
  },
  {
    x: 'pirate',
    y: 'archer',
    intended: 'even',
    reason:
      'Both shoot: the Archer at any bearing, the Pirate only sideways but with a harder bump.',
  },
  {
    x: 'pirate',
    y: 'storm',
    intended: 'even',
    reason:
      'The Storm’s strikes land wherever the Pirate is; the Pirate shoots the Storm as they pass.',
  },
  {
    x: 'pirate',
    y: 'frost',
    intended: 'even',
    reason:
      'The slow Frost lingers alongside for broadsides, but each bump it lands slows the Pirate.',
  },
  {
    x: 'pirate',
    y: 'thorns',
    intended: 'x',
    level: 'edge',
    reason:
      'Cannonballs never touch the Thorns’ spikes: the Pirate hurts it from the side without bumping.',
  },
  {
    x: 'pirate',
    y: 'venom',
    intended: 'even',
    reason: 'The Venom’s poison lands on its bumps; the Pirate’s broadsides land between them.',
  },
  {
    x: 'pirate',
    y: 'berserker',
    intended: 'even',
    reason: 'Every cannonball builds the Berserker’s rage, which it lets out on its next bump.',
  },
  {
    x: 'pirate',
    y: 'sniper',
    intended: 'even',
    reason: 'Shot for shot: the Sniper aims at any bearing, the Pirate only sideways.',
  },
  {
    x: 'pirate',
    y: 'quake',
    intended: 'even',
    reason:
      'The Quake’s wall shockwaves catch the Pirate; the Pirate shoots it as it runs along the walls.',
  },
  {
    x: 'pirate',
    y: 'magnet',
    intended: 'even',
    reason: 'The Magnet’s pull drags the Pirate in nose first, where its guns can’t point.',
  },
  {
    x: 'pirate',
    y: 'ghost',
    intended: 'even',
    reason: 'Cannonballs pass through a phased Ghost, but it is solid most of the time.',
  },
  {
    x: 'pirate',
    y: 'necromancer',
    intended: 'even',
    reason: 'The skeleton draws the broadsides, which then miss the Necromancer itself.',
  },
  {
    x: 'pirate',
    y: 'chrono',
    intended: 'x',
    level: 'strong',
    reason: 'Cannonballs are small hits, under what the Chrono rewinds, so every broadside sticks.',
  },
  {
    x: 'pirate',
    y: 'titan',
    intended: 'even',
    reason: 'A growing Titan is an easy target from the side, but its bumps grow too.',
  },
  {
    x: 'pirate',
    y: 'inferno',
    intended: 'x',
    level: 'strong',
    reason:
      'The Pirate shoots the Inferno from the side instead of chasing through its trail of fire.',
  },
  {
    x: 'pirate',
    y: 'boomerang',
    intended: 'x',
    level: 'edge',
    reason: 'The boomerang’s hits are light; the Pirate’s bump and broadsides are not.',
  },
  {
    x: 'pirate',
    y: 'bomber',
    intended: 'even',
    reason: 'The Pirate shoots from beside the Bomber’s path, but runs into its bombs as it sails.',
  },
  {
    x: 'pirate',
    y: 'spartan',
    intended: 'x',
    level: 'edge',
    reason: 'A planted Spartan sits still for the Pirate to sail past and shoot, shield or not.',
  },
  {
    x: 'pirate',
    y: 'bloom',
    intended: 'x',
    level: 'strong',
    reason:
      'Every cannonball resets the Bloom’s 2 s regrowth wait, so it shoots it from afar before it regrows.',
  },
  {
    x: 'pirate',
    y: 'hex',
    intended: 'even',
    reason: 'The Hex’s curse comes from its bump; the Pirate’s broadsides hit without touching it.',
  },
  {
    x: 'pirate',
    y: 'spider',
    intended: 'x',
    level: 'edge',
    reason:
      'The Spider’s webs are on the walls; the Pirate shoots it in open water as it sails past.',
  },
  {
    x: 'pirate',
    y: 'battery',
    intended: 'even',
    reason: 'Cannonballs are not the big strikes the Battery stores, so it charges up slowly.',
  },
  {
    x: 'pirate',
    y: 'slime',
    intended: 'y',
    level: 'strong',
    reason:
      'The Slime splits into two smaller halves: the Pirate fires at one and the other bumps it.',
  },
  {
    x: 'pirate',
    y: 'balloon',
    intended: 'x',
    level: 'strong',
    reason: 'Shots hit the floating Balloon harder, and the Pirate’s broadsides are shots.',
  },
  {
    x: 'pirate',
    y: 'banshee',
    intended: 'even',
    reason: 'The Banshee’s wail reaches all around it; the Pirate’s guns only sideways.',
  },
  {
    x: 'pirate',
    y: 'kraken',
    intended: 'even',
    reason: 'The Kraken holds it close, and a held Pirate alongside still fires out of its side.',
  },
  {
    x: 'pirate',
    y: 'mirage',
    intended: 'y',
    level: 'strong',
    reason:
      'Its broadsides fire when the Mirage’s copy is alongside, so they mostly miss the real ball.',
  },
  {
    x: 'pirate',
    y: 'jouster',
    intended: 'y',
    level: 'edge',
    reason: 'The Jouster charges head-on, the one bearing the Pirate’s guns can’t cover.',
  },
];

// Counter-map entries for Poseidon (prototype): every pair of it with another ball, labelled
// from its last 150-seed `pnpm balance --ball` run (s3, DROPPED) by the one rule (ADR 0073).
import type { CounterEntry } from './counter-map.ts';

/**
 * Every few seconds a wave sweeps the court and throws its enemies at the far wall, where they crash
 * for 12 times their lightness. Heavy balls (a grown Titan) barely turn and crash softly; a phased
 * ball is not swept. Its own bump is weak.
 */
export const POSEIDON_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'poseidon',
    y: 'brawler',
    intended: 'even',
    reason:
      'The Brawler’s heavy bump wants contact; waves carry it off, and crashes add little either way.',
  },
  {
    x: 'poseidon',
    y: 'speedster',
    intended: 'even',
    reason:
      'The Speedster is thrown and crashes often, but its speed brings it back to bump sooner.',
  },
  {
    x: 'poseidon',
    y: 'vampire',
    intended: 'x',
    level: 'edge',
    reason: 'Crashes are hits from afar that the Vampire cannot drink back.',
  },
  {
    x: 'poseidon',
    y: 'archer',
    intended: 'even',
    reason: 'The Archer shoots from the far wall it is thrown at; crashes and arrows trade.',
  },
  {
    x: 'poseidon',
    y: 'storm',
    intended: 'even',
    reason: 'Waves scatter the Storm, but its strikes land wherever Poseidon roams.',
  },
  {
    x: 'poseidon',
    y: 'frost',
    intended: 'x',
    level: 'edge',
    reason: 'Crashes need no contact, so the Frost’s slowing bump buys it little.',
  },
  {
    x: 'poseidon',
    y: 'thorns',
    intended: 'x',
    level: 'edge',
    reason: 'Crashes hurt the Thorns without touching its spikes.',
  },
  {
    x: 'poseidon',
    y: 'venom',
    intended: 'even',
    reason: 'Venom’s poison and Poseidon’s crashes both deal damage from afar.',
  },
  {
    x: 'poseidon',
    y: 'berserker',
    intended: 'even',
    reason: 'Every crash builds the Berserker’s rage for its next bump.',
  },
  {
    x: 'poseidon',
    y: 'sniper',
    intended: 'even',
    reason: 'The Sniper aims from the wall it is thrown at; crashes and shots trade.',
  },
  {
    x: 'poseidon',
    y: 'quake',
    intended: 'even',
    reason: 'Quake shocks reach Poseidon wherever the wave leaves it.',
  },
  {
    x: 'poseidon',
    y: 'magnet',
    intended: 'y',
    level: 'edge',
    reason: 'The Magnet pulls Poseidon back in for its heavy bump after every wave.',
  },
  {
    x: 'poseidon',
    y: 'ghost',
    intended: 'even',
    reason: 'A phased Ghost is not swept, so it misses some crashes.',
  },
  {
    x: 'poseidon',
    y: 'necromancer',
    intended: 'even',
    reason: 'Waves push minions’ master away, but the minions still swarm.',
  },
  {
    x: 'poseidon',
    y: 'chrono',
    intended: 'x',
    level: 'edge',
    reason: 'Rewinding cannot undo a crash into the wall.',
  },
  {
    x: 'poseidon',
    y: 'titan',
    intended: 'y',
    level: 'strong',
    reason:
      'A grown Titan barely turns in the wave and crashes softly, and its grown bump crushes Poseidon’s weak one.',
  },
  {
    x: 'poseidon',
    y: 'inferno',
    intended: 'even',
    reason: 'Fire patches and crashes trade evenly.',
  },
  {
    x: 'poseidon',
    y: 'boomerang',
    intended: 'even',
    reason: 'The Boomerang hits from afar as Poseidon does.',
  },
  {
    x: 'poseidon',
    y: 'bomber',
    intended: 'y',
    level: 'edge',
    reason:
      'Waves carry Poseidon’s enemies over the Bomber’s bombs only rarely, and its blasts outdamage the weak bump.',
  },
  {
    x: 'poseidon',
    y: 'spartan',
    intended: 'even',
    reason:
      'A raised shield takes less of a bump, not of a crash, but the Spartan slows and is pushed less far.',
  },
  {
    x: 'poseidon',
    y: 'bloom',
    intended: 'even',
    reason: 'Bloom’s healing undoes crashes about as fast as they land.',
  },
  {
    x: 'poseidon',
    y: 'hex',
    intended: 'even',
    reason: 'The Hex’s curse and Poseidon’s crashes trade evenly.',
  },
  {
    x: 'poseidon',
    y: 'spider',
    intended: 'x',
    level: 'strong',
    reason:
      'Webs need the Spider near its prey; the wave keeps throwing its prey off them and into the wall.',
  },
  {
    x: 'poseidon',
    y: 'battery',
    intended: 'even',
    reason: 'The fast Battery is thrown often but bumps back hard.',
  },
  {
    x: 'poseidon',
    y: 'slime',
    intended: 'even',
    reason: 'Each light half is thrown and crashes, but there are two to sweep.',
  },
  {
    x: 'poseidon',
    y: 'balloon',
    intended: 'even',
    reason: 'The floating Balloon is swept like any ball; even trade.',
  },
  {
    x: 'poseidon',
    y: 'banshee',
    intended: 'even',
    reason: 'The Banshee’s wail and Poseidon’s waves both strike from afar.',
  },
  {
    x: 'poseidon',
    y: 'kraken',
    intended: 'even',
    reason: 'The Kraken’s grip holds its prey still, but waves still throw it.',
  },
  {
    x: 'poseidon',
    y: 'mirage',
    intended: 'even',
    reason: 'The Mirage’s copy draws aim, but a wave sweeps the whole court.',
  },
  {
    x: 'poseidon',
    y: 'jouster',
    intended: 'y',
    level: 'strong',
    reason:
      'A charging Jouster runs straight through the wave, and its lance outhits Poseidon’s weak bump.',
  },
];

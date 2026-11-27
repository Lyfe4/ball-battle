// Counter-map entries for the Scorpion (prototype, DROPPED): every pair of it with another ball,
// labelled from its last 150-seed `pnpm balance --ball scorpion` run (s3) by the one rule (ADR 0073).
import type { CounterEntry } from './counter-map.ts';

/**
 * Its tail stings the nearest body within reach, before contact. Balls that must close in to hurt
 * are stung on every approach; balls whose damage lands from afar, or grows from being hurt, are not.
 */
export const SCORPION_ENTRIES: readonly CounterEntry[] = [
  {
    x: 'scorpion',
    y: 'brawler',
    intended: 'even',
    reason: 'Its stings land on the way in, but the Brawler’s 26 bump trades them back.',
  },
  {
    x: 'scorpion',
    y: 'speedster',
    intended: 'even',
    reason: 'The Speedster closes fast and is stung every pass; its speed hits answer the stings.',
  },
  {
    x: 'scorpion',
    y: 'vampire',
    intended: 'even',
    reason: 'Stings land before each bite, but the Vampire heals back what they cost.',
  },
  {
    x: 'scorpion',
    y: 'archer',
    intended: 'even',
    reason:
      'The Archer’s arrows hurt from afar, yet it still drifts into reach and its frail body is stung.',
  },
  {
    x: 'scorpion',
    y: 'storm',
    intended: 'y',
    level: 'edge',
    reason:
      'The Storm’s lightning lands from across the court; the tail only reaches what comes near.',
  },
  {
    x: 'scorpion',
    y: 'frost',
    intended: 'y',
    level: 'edge',
    reason:
      'The Frost’s chill slows the Scorpion between stings, and its own health outlasts them.',
  },
  {
    x: 'scorpion',
    y: 'thorns',
    intended: 'even',
    reason: 'Stings are ability damage the spikes never return, but the Thorns’ health soaks them.',
  },
  {
    x: 'scorpion',
    y: 'venom',
    intended: 'even',
    reason: 'Venom poisons with every bump; stings and poison trade evenly.',
  },
  {
    x: 'scorpion',
    y: 'berserker',
    intended: 'y',
    level: 'strong',
    reason:
      'Every sting enrages the Berserker: hurting it before contact makes its next bump land harder.',
  },
  {
    x: 'scorpion',
    y: 'sniper',
    intended: 'even',
    reason: 'The Sniper hits from afar but drifts into reach between shots: an even trade.',
  },
  {
    x: 'scorpion',
    y: 'quake',
    intended: 'y',
    level: 'edge',
    reason: 'The Quake’s shockwave hits the whole court around it, from beyond the tail’s reach.',
  },
  {
    x: 'scorpion',
    y: 'magnet',
    intended: 'even',
    reason: 'The Magnet pulls the Scorpion in, into its own reach: hard bumps against stings.',
  },
  {
    x: 'scorpion',
    y: 'ghost',
    intended: 'even',
    reason: 'A phased Ghost takes no sting; it is stung only while solid.',
  },
  {
    x: 'scorpion',
    y: 'necromancer',
    intended: 'x',
    level: 'strong',
    reason:
      'The tail swats every skull that comes within reach before it can pop, so the Necromancer fights with bumps alone.',
  },
  {
    x: 'scorpion',
    y: 'chrono',
    intended: 'x',
    level: 'edge',
    reason:
      'The Chrono must close in to hurt, so it is stung on every approach; a rewind keeps the stings it took.',
  },
  {
    x: 'scorpion',
    y: 'titan',
    intended: 'y',
    level: 'edge',
    reason: 'The Titan grows and its health outlasts the stings; its weight answers the weak bump.',
  },
  {
    x: 'scorpion',
    y: 'inferno',
    intended: 'even',
    reason: 'The Inferno’s fire burns from its trail; stings land when it comes near: even.',
  },
  {
    x: 'scorpion',
    y: 'boomerang',
    intended: 'even',
    reason: 'The boomerang hits from afar and coming back; the Boomerang still drifts into reach.',
  },
  {
    x: 'scorpion',
    y: 'bomber',
    intended: 'even',
    reason: 'Bombs hurt from a distance; the Bomber is stung when it comes near.',
  },
  {
    x: 'scorpion',
    y: 'spartan',
    intended: 'even',
    reason: 'The planted shield halves the stings, and its spear hits from range: even.',
  },
  {
    x: 'scorpion',
    y: 'bloom',
    intended: 'x',
    level: 'edge',
    reason: 'The Bloom must close in to hurt, and is stung on every approach before it touches.',
  },
  {
    x: 'scorpion',
    y: 'hex',
    intended: 'even',
    reason: 'The Hex’s curse lands whatever the range; stings land when it comes near.',
  },
  {
    x: 'scorpion',
    y: 'spider',
    intended: 'even',
    reason: 'Webs slow the Scorpion, but a slowed Spider comes into reach as often.',
  },
  {
    x: 'scorpion',
    y: 'battery',
    intended: 'even',
    reason: 'The Battery stores only big strikes; small stings never charge it.',
  },
  {
    x: 'scorpion',
    y: 'slime',
    intended: 'even',
    reason: 'Its halves each come into reach; the tail stings one at a time.',
  },
  {
    x: 'scorpion',
    y: 'balloon',
    intended: 'even',
    reason: 'Stings are neither area nor shots: they land on the Balloon as they are.',
  },
  {
    x: 'scorpion',
    y: 'banshee',
    intended: 'x',
    level: 'edge',
    reason: 'The Banshee’s bump is weak, so it trades poorly once in reach of the tail.',
  },
  {
    x: 'scorpion',
    y: 'kraken',
    intended: 'y',
    level: 'edge',
    reason: 'The Kraken grabs from a distance and holds the Scorpion where its bumps land.',
  },
  {
    x: 'scorpion',
    y: 'mirage',
    intended: 'even',
    reason:
      'The tail is a reflex, not an aimed attack, so the copy never draws it: plain against plain.',
  },
  {
    x: 'scorpion',
    y: 'jouster',
    intended: 'even',
    reason: 'A charging Jouster is stung on the way in, but its lance hits triple.',
  },
];

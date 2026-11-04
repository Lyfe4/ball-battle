import { archerDesign } from './archer.ts';
import { berserkerDesign } from './berserker.ts';
import { brawlerDesign } from './brawler.ts';
import { frostDesign } from './frost.ts';
import { quakeDesign } from './quake.ts';
import { sniperDesign } from './sniper.ts';
import { speedsterDesign } from './speedster.ts';
import { stormDesign } from './storm.ts';
import { thornsDesign } from './thorns.ts';
import type { BallDesign } from './types.ts';
import { vampireDesign } from './vampire.ts';
import { venomDesign } from './venom.ts';

/**
 * How each kind of ball looks, keyed by definition id. A ball without an entry is drawn as a
 * plain disc in its colour. Add a new ball's design here.
 */
export const BALL_DESIGNS: ReadonlyMap<string, BallDesign> = new Map([
  ['brawler', brawlerDesign],
  ['speedster', speedsterDesign],
  ['vampire', vampireDesign],
  ['archer', archerDesign],
  ['storm', stormDesign],
  ['frost', frostDesign],
  ['thorns', thornsDesign],
  ['venom', venomDesign],
  ['berserker', berserkerDesign],
  ['sniper', sniperDesign],
  ['quake', quakeDesign],
]);

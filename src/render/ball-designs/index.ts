import { archerDesign } from './archer.ts';
import { brawlerDesign } from './brawler.ts';
import { frostDesign } from './frost.ts';
import { speedsterDesign } from './speedster.ts';
import { stormDesign } from './storm.ts';
import { thornsDesign } from './thorns.ts';
import type { BallDesign } from './types.ts';
import { vampireDesign } from './vampire.ts';

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
]);

import { indexDefinitions } from '../definitions.ts';
import type { BallDefinition } from '../types.ts';
import { archer } from './archer.ts';
import { berserker } from './berserker.ts';
import { brawler } from './brawler.ts';
import { frost } from './frost.ts';
import { quake } from './quake.ts';
import { sniper } from './sniper.ts';
import { speedster } from './speedster.ts';
import { storm } from './storm.ts';
import { thorns } from './thorns.ts';
import { vampire } from './vampire.ts';
import { venom } from './venom.ts';

/** Every playable ball, in picker order. Add a new ball's file here. */
export const BALLS: readonly BallDefinition[] = [
  brawler,
  speedster,
  vampire,
  archer,
  storm,
  frost,
  thorns,
  venom,
  berserker,
  sniper,
  quake,
];

export const BALL_LOOKUP = indexDefinitions(BALLS);

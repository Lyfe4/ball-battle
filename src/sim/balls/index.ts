import { indexDefinitions } from '../definitions.ts';
import type { BallDefinition } from '../types.ts';
import { archer } from './archer.ts';
import { brawler } from './brawler.ts';
import { speedster } from './speedster.ts';
import { storm } from './storm.ts';
import { vampire } from './vampire.ts';

/** Every playable ball, in picker order. Add a new ball's file here. */
export const BALLS: readonly BallDefinition[] = [brawler, speedster, vampire, archer, storm];

export const BALL_LOOKUP = indexDefinitions(BALLS);

import { describe, expect, it } from 'vitest';
import { createWorld } from '../sim/world.ts';
import { blue, red, withBalls } from '../sim/test-support.ts';
import type { WorldState } from '../sim/types.ts';
import { smearsOf } from './motion-smear.ts';
import { theme } from './theme.ts';

/** A world at `tick` with the red ball at `redX` and the blue one at rest far away. */
function at(redX: number, tick = 10): WorldState {
  const world = withBalls(createWorld(1, [red, blue]), [
    { position: { x: redX, y: 200 }, velocity: { x: 770, y: 0 } },
    { position: { x: 800, y: 800 }, velocity: { x: 0, y: 0 } },
  ]);
  return { ...world, tick };
}

const SLOW = 1000 / 30;
const FAST = 1000 / 60;
const pointsOf = (smears: ReturnType<typeof smearsOf>) => smears.map((smear) => smear.points);

describe('smearsOf', () => {
  it('trails a ball over its path through the last two frames on a slow frame', () => {
    expect(smearsOf([at(174), at(200)], at(226), SLOW, false)).toStrictEqual([
      {
        ballId: 'ball-0',
        points: [
          { x: 174, y: 200 },
          { x: 200, y: 200 },
          { x: 226, y: 200 },
        ],
        radius: 50,
      },
    ]);
  });

  it('draws nothing at 60 frames a second or faster: those look as they always did', () => {
    expect(smearsOf([at(200)], at(213), FAST, false)).toStrictEqual([]);
    expect(smearsOf([at(200)], at(213), theme.smearMinFrameMs - 0.1, false)).toStrictEqual([]);
  });

  it('draws nothing under reduced motion, on a first frame or once the match is over', () => {
    expect(smearsOf([at(200)], at(226), SLOW, true)).toStrictEqual([]);
    expect(smearsOf([], at(226), SLOW, false)).toStrictEqual([]);
    const over = at(226);
    const finished = { ...over, match: { ...over.match, status: 'finished' as const } };
    expect(smearsOf([at(200)], finished as WorldState, SLOW, false)).toStrictEqual([]);
  });

  it('stops at a step where the ball stood still (a hit-stop) or jumped (a rewind)', () => {
    expect(smearsOf([at(200)], at(201), SLOW, false)).toStrictEqual([]);
    expect(smearsOf([at(200)], at(320), SLOW, false)).toStrictEqual([]);
    // Jumped two frames back, moved since: only the last step trails.
    expect(pointsOf(smearsOf([at(40), at(200)], at(226), SLOW, false))).toStrictEqual([
      [
        { x: 200, y: 200 },
        { x: 226, y: 200 },
      ],
    ]);
  });

  it('leaves out a knocked-out ball', () => {
    const now = at(226);
    const out = { ...now, balls: now.balls.map((ball) => ({ ...ball, health: 0 })) };
    expect(smearsOf([at(200)], out, SLOW, false)).toStrictEqual([]);
  });
});

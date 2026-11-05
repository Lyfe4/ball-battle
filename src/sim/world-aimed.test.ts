import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP, BALLS } from './balls/index.ts';
import { getDefinition } from './definitions.ts';
import { seedRng } from './rng.ts';
import { playToEnd } from './series.ts';
import { blue, red, run } from './test-support.ts';
import type { Vec2 } from './types.ts';
import { vec2 } from './vec2.ts';
import { AIMED_STARTS, aimDirection, createWorld, RANDOM_START, type StartMode } from './world.ts';

const definitions = [red, blue];
const aimed = (a: Vec2, b: Vec2): StartMode => ({ kind: 'aimed', aims: [a, b] });
/** Each ball aimed straight at the other's spot. */
const headOn = aimed(AIMED_STARTS[1], AIMED_STARTS[0]);

describe('createWorld, default (random) start', () => {
  it('is exactly the start the game has always played (pinned seed 42)', () => {
    // Recorded from createWorld before the aimed start existed. If this changes, every replay,
    // shared link and balance number changes with it.
    const world = createWorld(42, definitions);
    expect(world.balls.map((ball) => [ball.position, ball.velocity])).toStrictEqual([
      [
        { x: 290.44150076806545, y: 453.4615030977875 },
        { x: 720.7787225555041, y: 347.0994570886788 },
      ],
      [
        { x: 636.8352367635816, y: 522.5504757724702 },
        { x: -490.6625883590922, y: 269.90780719489385 },
      ],
    ]);
    expect(world.rngState).toBe(1767624658);
  });

  it('is what RANDOM_START gives', () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(createWorld(seed, definitions)).toStrictEqual(
        createWorld(seed, definitions, RANDOM_START),
      );
    }
  });
});

describe('createWorld, aimed start', () => {
  it('puts the two balls on fixed spots that mirror each other across the centre', () => {
    for (const seed of [0, 1, 99]) {
      const [a, b] = createWorld(seed, definitions, aimed(vec2(0, 0), vec2(1000, 1000))).balls;
      expect(a?.position).toStrictEqual(vec2(250, 500));
      expect(b?.position).toStrictEqual(vec2(750, 500));
    }
  });

  it('launches each ball at its definition speed, straight at its aim point', () => {
    const aims: readonly (readonly [Vec2, Vec2])[] = [
      [vec2(750, 500), vec2(250, 500)],
      [vec2(0, 0), vec2(1000, 1000)],
      [vec2(250, 0), vec2(750, 1000)],
      [vec2(1000, 137), vec2(3, 999)],
      [vec2(251, 500), vec2(749, 499)],
    ];
    for (const [aimA, aimB] of aims) {
      const world = createWorld(7, definitions, aimed(aimA, aimB));
      world.balls.forEach((ball, index) => {
        const aim = index === 0 ? aimA : aimB;
        const toAim = { x: aim.x - ball.position.x, y: aim.y - ball.position.y };
        const { x: vx, y: vy } = ball.velocity;
        const speed = Math.sqrt(vx * vx + vy * vy);
        expect(speed).toBeCloseTo(definitions[index]?.speed ?? NaN, 9);
        // Parallel (zero cross product) and pointing the same way (positive dot product).
        const length = Math.sqrt(toAim.x * toAim.x + toAim.y * toAim.y);
        expect((vx * toAim.y - vy * toAim.x) / (speed * length)).toBeCloseTo(0, 12);
        expect(vx * toAim.x + vy * toAim.y).toBeGreaterThan(0);
      });
    }
  });

  it('draws nothing from the RNG, so the seed still decides everything after the launch', () => {
    const one = createWorld(1, definitions, headOn);
    const two = createWorld(2, definitions, headOn);
    expect({ ...one, rngState: 0 }).toStrictEqual({ ...two, rngState: 0 });
    expect(one.rngState).toBe(seedRng(1));
    expect(two.rngState).toBe(seedRng(2));
  });

  it('is deterministic over a whole match with real balls', () => {
    const balls = [getDefinition(BALL_LOOKUP, 'archer'), getDefinition(BALL_LOOKUP, 'quake')];
    const start = aimed(vec2(250, 0), vec2(1000, 1000));
    const first = playToEnd(createWorld(5, balls, start), BALL_LOOKUP);
    const second = playToEnd(createWorld(5, balls, start), BALL_LOOKUP);
    expect(first.match.status).toBe('finished');
    expect(first).toStrictEqual(second);
  });

  it('plays differently for a different aim', () => {
    const a = run(createWorld(3, definitions, headOn), 120).world;
    const b = run(createWorld(3, definitions, aimed(vec2(250, 0), vec2(750, 0))), 120).world;
    expect(a).not.toStrictEqual(b);
  });

  it('rejects aim points that are not whole numbers inside the arena', () => {
    const invalid: readonly Vec2[] = [
      vec2(250.5, 0),
      vec2(0, 0.1),
      vec2(-1, 0),
      vec2(0, 1001),
      vec2(Number.NaN, 0),
      vec2(Number.POSITIVE_INFINITY, 0),
    ];
    for (const aim of invalid) {
      expect(() => createWorld(1, definitions, aimed(aim, vec2(0, 0)))).toThrow(/whole numbers/);
      expect(() => createWorld(1, definitions, aimed(vec2(0, 0), aim))).toThrow(/whole numbers/);
    }
  });

  it("rejects aiming at the ball's own spot, which has no direction", () => {
    expect(() => createWorld(1, definitions, aimed(vec2(250, 500), vec2(0, 0)))).toThrow(
      /own position/,
    );
    expect(() => createWorld(1, definitions, aimed(vec2(0, 0), vec2(750, 500)))).toThrow(
      /own position/,
    );
  });

  it('needs exactly two balls and one aim point per ball', () => {
    const three = [red, blue, red];
    expect(() =>
      createWorld(1, three, { kind: 'aimed', aims: [vec2(0, 0), vec2(0, 0), vec2(0, 0)] }),
    ).toThrow(/exactly 2 balls/);
    expect(() => createWorld(1, definitions, { kind: 'aimed', aims: [vec2(0, 0)] })).toThrow(
      /one aim point per ball/,
    );
  });

  it('works for every ball in the roster', () => {
    for (const ball of BALLS) {
      expect(() => createWorld(1, [ball, ball], headOn)).not.toThrow();
    }
  });
});

describe('aimDirection', () => {
  it('is a unit vector from Math.sqrt alone', () => {
    expect(aimDirection(vec2(0, 0), vec2(3, 4), 1000)).toStrictEqual(vec2(0.6, 0.8));
    expect(aimDirection(vec2(250, 500), vec2(250, 0), 1000)).toStrictEqual(vec2(0, -1));
  });
});

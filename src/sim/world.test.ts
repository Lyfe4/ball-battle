import { describe, expect, it } from 'vitest';
import { blue } from './balls/blue.ts';
import { red } from './balls/red.ts';
import type { BallDefinition } from './types.ts';
import { createWorld } from './world.ts';

const definitions = [red, blue];

describe('createWorld', () => {
  it('is deterministic for a given seed', () => {
    expect(createWorld(42, definitions)).toStrictEqual(createWorld(42, definitions));
  });

  it('differs between seeds', () => {
    expect(createWorld(1, definitions)).not.toStrictEqual(createWorld(2, definitions));
  });

  it('places balls fully inside the arena, apart, moving at their definition speed', () => {
    for (let seed = 0; seed < 500; seed++) {
      const world = createWorld(seed, definitions);
      const [a, b] = world.balls;
      if (a === undefined || b === undefined) throw new Error('expected two balls');

      world.balls.forEach((ball, index) => {
        const { x, y } = ball.position;
        expect(x - ball.radius).toBeGreaterThanOrEqual(0);
        expect(y - ball.radius).toBeGreaterThanOrEqual(0);
        expect(x + ball.radius).toBeLessThanOrEqual(world.arena.size);
        expect(y + ball.radius).toBeLessThanOrEqual(world.arena.size);
        const { x: vx, y: vy } = ball.velocity;
        expect(Math.sqrt(vx * vx + vy * vy)).toBeCloseTo(definitions[index]?.speed ?? NaN, 6);
      });

      const dx = a.position.x - b.position.x;
      const dy = a.position.y - b.position.y;
      expect(Math.sqrt(dx * dx + dy * dy)).toBeGreaterThanOrEqual(a.radius + b.radius);
    }
  });

  it('starts at tick 0 with definition ids and unique ball ids', () => {
    const world = createWorld(3, definitions);
    expect(world.tick).toBe(0);
    expect(world.balls.map((ball) => ball.definitionId)).toStrictEqual(['red', 'blue']);
    expect(world.balls.map((ball) => ball.id)).toStrictEqual(['ball-0', 'ball-1']);
  });

  it('rejects fewer than two balls and balls too large for their strip', () => {
    expect(() => createWorld(1, [])).toThrow(/at least two/);
    expect(() => createWorld(1, [red])).toThrow(/at least two/);
    const huge: BallDefinition = { ...red, id: 'huge', radius: 300 };
    expect(() => createWorld(1, [huge, huge])).toThrow(/too large/);
  });
});

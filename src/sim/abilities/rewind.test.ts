// onKnockedOut and the rewind action (ADR 0034): a ball brought to 0 may put itself back.
import { describe, expect, it } from 'vitest';
import { defineBall } from '../define-ball.ts';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { red, withBalls } from '../test-support.ts';
import type { SimEvent, Vec2, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';

const BACK_TO: Vec2 = { x: 200, y: 200 };

/** A fragile test-only ball that, knocked out, rewinds to BACK_TO with 30 health, if `rewinds`. */
function fragile(rewinds: boolean, to: Vec2 = BACK_TO) {
  return defineBall<Readonly<{ used: boolean }>>({
    id: 'fragile',
    name: 'Fragile',
    description: 'Test fixture: rewinds when knocked out.',
    color: '#ffffff',
    radius: 50,
    speed: 700,
    maxHealth: 40,
    contactDamage: 5,
    initialAbilityState: { used: false },
    hooks: rewinds
      ? {
          onKnockedOut: ({ self }) =>
            self.abilityState.used
              ? []
              : [
                  { kind: 'rewind', position: to, velocity: { x: 0, y: -700 }, health: 30 },
                  { kind: 'setAbilityState', state: { used: true } },
                ],
        }
      : {},
  });
}

/** The fragile ball on 1 health, about to meet red head-on. */
function headOn(rewinds: boolean, to?: Vec2) {
  const ball = fragile(rewinds, to);
  const lookup = indexDefinitions([ball, red]);
  const world = withBalls(createWorld(1, [ball, red]), [
    { position: { x: 440, y: 500 }, velocity: { x: 700, y: 0 }, health: 1 },
    { position: { x: 560, y: 500 }, velocity: { x: -800, y: 0 } },
  ]);
  let current: WorldState = world;
  const events: SimEvent[] = [];
  const play = (ticks: number) => {
    for (let i = 0; i < ticks; i++) {
      const result = step(current, lookup);
      current = result.world;
      events.push(...result.events);
    }
    return current;
  };
  return { play, events };
}

describe('onKnockedOut and rewind', () => {
  it('a ball without the hook is defeated as before', () => {
    const { play, events } = headOn(false);
    const world = play(5);
    expect(world.match.status).toBe('finished');
    expect(events.some((event) => event.type === 'ballDefeated')).toBe(true);
  });

  it('puts a knocked-out ball back where it asked, with that health, before it is defeated', () => {
    const { play, events } = headOn(true);
    const world = play(5);
    expect(world.match.status).toBe('running');
    expect(events.some((event) => event.type === 'ballDefeated')).toBe(false);
    const rewound = events.find((event) => event.type === 'rewound');
    expect(rewound).toMatchObject({
      ballId: 'ball-0',
      to: BACK_TO,
      healthBefore: 0,
      healthAfter: 30,
    });
    const ball = world.balls[0];
    expect(ball?.health).toBe(30);
    // It used its one rewind: the actions after the rewind applied, as it was alive again.
    expect(ball?.abilityState).toStrictEqual({ used: true });
  });

  it('is safe when the old spot overlaps the enemy: the next tick separates them', () => {
    // Rewound onto red's own position.
    const { play } = headOn(true, { x: 560, y: 500 });
    const world = play(4);
    const [a, b] = world.balls;
    if (a === undefined || b === undefined) throw new Error('missing balls');
    const dx = b.position.x - a.position.x;
    const dy = b.position.y - a.position.y;
    expect(Math.sqrt(dx * dx + dy * dy)).toBeGreaterThanOrEqual(a.radius + b.radius - 1e-6);
    expect([a.position.x, a.position.y, b.position.x, b.position.y].every(Number.isFinite)).toBe(
      true,
    );
  });
});

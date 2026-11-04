import { describe, expect, it } from 'vitest';
import { DT } from '../constants.ts';
import { defineBall } from '../define-ball.ts';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, red, withBalls } from '../test-support.ts';
import type { BallHooks, SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';

type ProbeState = Readonly<{ log: readonly string[] }>;

/** A test-only ball whose hooks are supplied per test. Based on red's stats. */
function probe(hooks: BallHooks<ProbeState>) {
  return defineBall<ProbeState>({
    ...red,
    id: 'probe',
    name: 'Probe',
    initialAbilityState: { log: [] },
    hooks,
  });
}

/** Appends an entry to the probe's log. */
function logged(state: ProbeState, entry: string) {
  return { kind: 'setAbilityState', state: { log: [...state.log, entry] } } as const;
}

function logOf(world: WorldState, index = 0): readonly string[] {
  const log = world.balls[index]?.abilityState['log'];
  return Array.isArray(log) ? log.map(String) : [];
}

function play(world: WorldState, definition: ReturnType<typeof probe>, ticks: number) {
  const lookup = indexDefinitions([definition, blue]);
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const result = step(current, lookup);
    current = result.world;
    events.push(...result.events);
  }
  return { world: current, events };
}

/** Probe at (x, y) moving (vx, vy); blue parked far away unless placed. */
function setup(
  definition: ReturnType<typeof probe>,
  probeBall: { x: number; y: number; vx: number; vy: number },
  other: { x: number; y: number; vx: number; vy: number } = { x: 850, y: 850, vx: 0, vy: 0 },
): WorldState {
  return withBalls(createWorld(1, [definition, blue]), [
    {
      position: { x: probeBall.x, y: probeBall.y },
      velocity: { x: probeBall.vx, y: probeBall.vy },
    },
    { position: { x: other.x, y: other.y }, velocity: { x: other.vx, y: other.vy } },
  ]);
}

describe('ability hooks', () => {
  it('runs onTick every tick, before movement', () => {
    const definition = probe({
      onTick: ({ world, self }) => [
        { kind: 'setVelocity', velocity: { x: 600, y: 0 } },
        logged(self.abilityState, `tick ${world.tick}`),
      ],
    });
    const { world } = play(setup(definition, { x: 200, y: 200, vx: 0, vy: 0 }), definition, 3);
    expect(logOf(world)).toStrictEqual(['tick 1', 'tick 2', 'tick 3']);
    // The velocity set in onTick already moved the ball in the same tick.
    expect(world.balls[0]?.position.x).toBeCloseTo(200 + 3 * 600 * DT, 9);
  });

  it('runs onWallHit only on ticks with a bounce, with the bounce count', () => {
    const definition = probe({
      onWallHit: ({ world, self, bounces }) => [
        logged(self.abilityState, `wall ${world.tick} x${bounces}`),
      ],
    });
    // 20 units from the right wall at 10 units/tick: hits it on tick 2 (and not again for a while).
    const right = 1000 - red.radius;
    const world = setup(definition, { x: right - 15, y: 500, vx: 10 / DT, vy: 0 });
    expect(logOf(play(world, definition, 10).world)).toStrictEqual(['wall 2 x1']);

    const corner = setup(definition, { x: right - 5, y: right - 5, vx: 10 / DT, vy: 10 / DT });
    expect(logOf(play(corner, definition, 1).world)).toStrictEqual(['wall 1 x2']);
  });

  it('runs onHitBall once when contact starts, not while it lasts', () => {
    const definition = probe({
      onHitBall: ({ world, self, other }) => [
        logged(self.abilityState, `hit ${other.id} at ${world.tick}`),
      ],
    });
    // Overlapping and moving together: one contact that lasts the whole run.
    const together = setup(
      definition,
      { x: 300, y: 500, vx: 120, vy: 0 },
      { x: 300 + red.radius + blue.radius - 5, y: 500, vx: 120, vy: 0 },
    );
    expect(logOf(play(together, definition, 60).world)).toStrictEqual(['hit ball-1 at 1']);
  });

  it('runs onDamageDealt after contact damage with the amount, and not for its own damage', () => {
    const definition = probe({
      onDamageDealt: ({ self, target, amount, cause }) => [
        logged(self.abilityState, `dealt ${amount} to ${target.id} (${cause})`),
        { kind: 'damage', targetId: target.id, amount: 1 },
      ],
    });
    const headOn = setup(
      definition,
      { x: 400, y: 500, vx: red.speed, vy: 0 },
      { x: 600, y: 500, vx: -blue.speed, vy: 0 },
    );
    const { world, events } = play(headOn, definition, 30);
    expect(logOf(world)).toStrictEqual([`dealt ${red.contactDamage} to ball-1 (contact)`]);
    const hitTick = events.find((event) => event.type === 'collision')?.tick;
    expect(
      events.filter((event) => event.tick === hitTick).map((event) => event.type),
    ).toStrictEqual(['collision', 'damage', 'damage', 'abilityTriggered', 'damage']);
    expect(events.at(-1)).toMatchObject({ type: 'damage', cause: 'ability', amount: 1 });
  });

  it('applies actions in the order returned', () => {
    // The last setVelocity wins. Speed returns to cruise at the end of the tick; direction stays.
    const forwards = probe({
      onTick: () => [
        { kind: 'setVelocity', velocity: { x: 100, y: 0 } },
        { kind: 'setVelocity', velocity: { x: 0, y: 100 } },
      ],
    });
    const backwards = probe({
      onTick: () => [
        { kind: 'setVelocity', velocity: { x: 0, y: 100 } },
        { kind: 'setVelocity', velocity: { x: 100, y: 0 } },
      ],
    });
    const start = { x: 300, y: 300, vx: 50, vy: 0 };
    expect(play(setup(forwards, start), forwards, 1).world.balls[0]?.velocity.x).toBe(0);
    expect(play(setup(backwards, start), backwards, 1).world.balls[0]?.velocity.y).toBe(0);
  });

  it('shows every hook in a phase the same snapshot', () => {
    // Both balls are probes. Each damages the other by 10 and records its own health as the world
    // shows it. Ball 0's damage to ball 1 is applied first, but with collect-then-apply ball 1's
    // hook still sees itself at full health.
    const definition = probe({
      onTick: ({ world, self }) => {
        const other = world.balls.find((ball) => ball.id !== self.id);
        const seen = world.balls.find((ball) => ball.id === self.id)?.health ?? -1;
        return [
          { kind: 'damage', targetId: other?.id ?? '', amount: 10 },
          logged(self.abilityState, `saw ${seen}`),
        ];
      },
    });
    const lookup = indexDefinitions([definition]);
    const world = withBalls(createWorld(1, [definition, definition]), [
      { position: { x: 200, y: 200 }, velocity: { x: 0, y: 0 } },
      { position: { x: 800, y: 800 }, velocity: { x: 0, y: 0 } },
    ]);
    const next = step(world, lookup).world;
    expect(logOf(next, 0)).toStrictEqual([`saw ${red.maxHealth}`]);
    expect(logOf(next, 1)).toStrictEqual([`saw ${red.maxHealth}`]);
    expect(next.balls.map((ball) => ball.health)).toStrictEqual([
      red.maxHealth - 10,
      red.maxHealth - 10,
    ]);
  });

  it('does not run hooks for defeated balls', () => {
    const definition = probe({
      onTick: ({ world, self }) => [logged(self.abilityState, `tick ${world.tick}`)],
    });
    // Three balls so the match keeps running after the probe is defeated.
    const lookup = indexDefinitions([definition, blue]);
    let world = withBalls(createWorld(1, [definition, blue, blue]), [
      { health: 0 },
      { position: { x: 500, y: 500 } },
      { position: { x: 850, y: 150 } },
    ]);
    world = step(world, lookup).world;
    expect(logOf(world)).toStrictEqual([]);
  });

  it('emits abilityTriggered only when a hook returned actions', () => {
    const idle = probe({ onTick: () => [] });
    const { events } = play(setup(idle, { x: 300, y: 300, vx: 0, vy: 0 }), idle, 5);
    expect(events.filter((event) => event.type === 'abilityTriggered')).toStrictEqual([]);

    const busy = probe({ onTick: () => [{ kind: 'setVelocity', velocity: { x: 0, y: 0 } }] });
    const result = play(setup(busy, { x: 300, y: 300, vx: 0, vy: 0 }), busy, 2);
    expect(result.events).toStrictEqual([
      { type: 'abilityTriggered', tick: 1, ballId: 'ball-0', hook: 'onTick' },
      { type: 'abilityTriggered', tick: 2, ballId: 'ball-0', hook: 'onTick' },
    ]);
  });
});

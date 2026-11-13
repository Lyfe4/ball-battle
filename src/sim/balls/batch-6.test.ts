// The Hex, the Spider and the reworked Ghost (ADR 0049): each ball's own mechanic, on fixed scenes.
import { describe, expect, it } from 'vitest';
import { indexDefinitions } from '../definitions.ts';
import { step } from '../step.ts';
import { blue, red, withBalls } from '../test-support.ts';
import { POISON_DAMAGE, POISON_INTERVAL_TICKS } from '../status.ts';
import type { BallState, SimEvent, WorldState } from '../types.ts';
import { createWorld } from '../world.ts';
import { ghost, PHASE_CYCLE_TICKS, PHASE_TICKS, phasedAt, SPECTRAL_HIT } from './ghost.ts';
import { CURSE_FUSE_TICKS, curseBurstFor, hex, hexCurseOf } from './hex.ts';
import {
  MOST_WEBS,
  spider,
  WEB_HALF_LENGTH,
  WEB_NIP,
  WEB_SLOW_TICKS,
  WEB_TICKS,
  websOf,
} from './spider.ts';

const lookup = indexDefinitions([hex, spider, ghost, red, blue]);

function play(world: WorldState, ticks: number, onTick?: (world: WorldState) => void) {
  let current = world;
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks && current.match.status === 'running'; i++) {
    const result = step(current, lookup);
    current = result.world;
    events.push(...result.events);
    onTick?.(current);
  }
  return { world: current, events };
}

const still = { x: 0, y: 0 };
const ofType = <T extends SimEvent['type']>(events: readonly SimEvent[], type: T) =>
  events.filter((event): event is Extract<SimEvent, { type: T }> => event.type === type);
const damageTo = (events: readonly SimEvent[], id: string) =>
  ofType(events, 'damage').filter((event) => event.targetId === id);

describe('Hex', () => {
  /** The Hex and a target heading at each other along y = 500; the target has plenty of health. */
  const meeting = (target: typeof red, health = 10_000): WorldState =>
    withBalls(createWorld(1, [hex, target]), [
      { position: { x: 300, y: 500 }, velocity: { x: hex.speed, y: 0 } },
      { position: { x: 700, y: 500 }, velocity: { x: -target.speed, y: 0 }, health },
    ]);

  it('curses with its bump; the mark bursts CURSE_FUSE_TICKS later for a quarter of full health', () => {
    const { events } = play(meeting(red), CURSE_FUSE_TICKS + 60);
    const [bump] = ofType(events, 'collision');
    const bursts = damageTo(events, 'ball-1').filter((event) => event.via === 'onTick');
    expect(bump).toBeDefined();
    expect(bursts).toHaveLength(1);
    expect(bursts[0]?.tick).toBe((bump?.tick ?? 0) + CURSE_FUSE_TICKS);
    expect(bursts[0]?.amount).toBe(curseBurstFor(red.maxHealth));
    expect(curseBurstFor(red.maxHealth)).toBe(Math.round(red.maxHealth / 4));
  });

  it('bursts for a share of the cursed ball’s own full health, not what it has left', () => {
    const big = play(meeting(blue, 60), CURSE_FUSE_TICKS + 60);
    const burst = damageTo(big.events, 'ball-1').find((event) => event.via === 'onTick');
    expect(burst?.amount).toBe(curseBurstFor(blue.maxHealth));
    expect(curseBurstFor(blue.maxHealth)).toBeGreaterThan(curseBurstFor(red.maxHealth));
  });

  it('a bump on a ball already marked does nothing: the countdown keeps running', () => {
    const marked = withBalls(meeting(red), [
      { abilityState: { cursedId: 'ball-1', cursedTick: 0, burstTick: 100 } },
    ]);
    const { events } = play(marked, 101);
    expect(ofType(events, 'collision').length).toBeGreaterThan(0);
    const bursts = damageTo(events, 'ball-1').filter((event) => event.via === 'onTick');
    expect(bursts.map((event) => event.tick)).toStrictEqual([100]);
  });

  it('shows its curse on the ball it marked, from the bump until the burst', () => {
    const marked: number[] = [];
    let curse: ReturnType<typeof hexCurseOf>;
    play(meeting(red), CURSE_FUSE_TICKS + 60, (now) => {
      const shown = now.balls[0] === undefined ? undefined : hexCurseOf(now.balls[0]);
      curse ??= shown;
      if (shown !== undefined) marked.push(now.tick);
    });
    expect(curse?.cursedId).toBe('ball-1');
    const from = curse?.cursedTick ?? 0;
    expect(curse?.burstTick).toBe(from + CURSE_FUSE_TICKS);
    // Shown on every tick of the countdown, and gone once it bursts.
    expect(marked.slice(0, CURSE_FUSE_TICKS)).toStrictEqual(
      Array.from({ length: CURSE_FUSE_TICKS }, (_, index) => from + index),
    );
    expect(marked).not.toContain(from + CURSE_FUSE_TICKS);
  });
});

describe('Spider', () => {
  /** The Spider heading straight at the left wall from (200, 500); blue parked far off. */
  const toTheWall = (): WorldState =>
    withBalls(createWorld(1, [spider, blue]), [
      { position: { x: 200, y: 500 }, velocity: { x: -spider.speed, y: 0 } },
      { position: { x: 800, y: 800 }, velocity: still },
    ]);

  it('spins a web where it bounces off a wall', () => {
    const { world } = play(toTheWall(), 20);
    const webs = world.balls[0] === undefined ? undefined : websOf(world.balls[0]);
    expect(webs).toHaveLength(1);
    expect(webs?.[0]?.side).toBe(0);
    expect(Math.abs((webs?.[0]?.at ?? 0) - 500)).toBeLessThan(1);
    expect((webs?.[0]?.until ?? 0) - (webs?.[0]?.since ?? 0)).toBe(WEB_TICKS);
  });

  /** A web on the left wall at y = 500, and red about to bounce off the left wall at `y`. */
  const webbed = (y: number): WorldState =>
    withBalls(createWorld(1, [spider, red]), [
      {
        position: { x: 800, y: 200 },
        velocity: still,
        abilityState: { webs: [{ side: 0, at: 500, since: 0, until: WEB_TICKS }], caught: {} },
      },
      { position: { x: 120, y }, velocity: { x: -red.speed, y: 0 } },
    ]);

  it('nips and slows a ball that bounces off a web, once per bounce', () => {
    const { world, events } = play(webbed(500), 30);
    const nips = damageTo(events, 'ball-1');
    expect(nips.map((event) => event.amount)).toStrictEqual([WEB_NIP]);
    expect(nips[0]?.via).toBe('onTick');
    const slowed = world.balls[1]?.statuses.find((status) => status.kind === 'slowed');
    expect(slowed?.expiresTick).toBe((nips[0]?.tick ?? 0) + WEB_SLOW_TICKS);
  });

  it('leaves a ball that bounces off bare wall alone', () => {
    const { world, events } = play(webbed(500 + WEB_HALF_LENGTH + 100), 30);
    expect(damageTo(events, 'ball-1')).toStrictEqual([]);
    expect(world.balls[1]?.statuses).toStrictEqual([]);
  });

  it('keeps at most MOST_WEBS, newest kept, and a web fades after WEB_TICKS', () => {
    const many = Array.from({ length: MOST_WEBS }, (_, index) => ({
      side: 2,
      at: 100 + index * 2 * WEB_HALF_LENGTH,
      since: 0,
      until: 100 + index,
    }));
    const full = withBalls(toTheWall(), [{ abilityState: { webs: many, caught: {} } }]);
    const spun = play(full, 20).world.balls[0];
    const webs = spun === undefined ? [] : (websOf(spun) ?? []);
    expect(webs).toHaveLength(MOST_WEBS);
    expect(webs.at(-1)?.side).toBe(0);
    expect(webs.some((web) => web.until === 100)).toBe(false);
    const later = play(full, 120).world;
    const left = later.balls[0] === undefined ? [] : (websOf(later.balls[0]) ?? []);
    expect(left.every((web) => web.until > later.tick)).toBe(true);
    expect(left.some((web) => web.side === 0)).toBe(true);
  });
});

describe('Ghost', () => {
  const ghostOf = (world: WorldState): BallState | undefined => world.balls[0];

  it('is phased for PHASE_TICKS of every PHASE_CYCLE_TICKS, from a seeded point', () => {
    const parked = withBalls(createWorld(1, [ghost, blue]), [
      { position: { x: 200, y: 200 }, velocity: still },
      { position: { x: 800, y: 800 }, velocity: still },
    ]);
    const phased: number[] = [];
    const { world } = play(parked, 2 * PHASE_CYCLE_TICKS + 1, (now) => {
      if (ghostOf(now)?.abilityState['phased'] === true) phased.push(now.tick);
    });
    expect(phased).toHaveLength(2 * PHASE_TICKS);
    const phase = Number(ghostOf(world)?.abilityState['phase']);
    for (const tick of phased) expect(phasedAt(tick, phase)).toBe(true);
    const phases = new Set(
      [2, 3, 4, 5, 6].map(
        (seed) =>
          play(withBalls(createWorld(seed, [ghost, blue]), []), 2).world.balls[0]?.abilityState[
            'phase'
          ],
      ),
    );
    expect(phases.size).toBeGreaterThan(1);
  });

  /** A parked Ghost, poisoned from tick 0 by blue, held phased (phase 0) or solid (phase PHASE_TICKS). */
  const poisoned = (phase: number): WorldState =>
    withBalls(createWorld(1, [ghost, blue]), [
      {
        position: { x: 200, y: 200 },
        velocity: still,
        abilityState: { phase, phased: phasedAt(0, phase) },
        statuses: [{ kind: 'poisoned', sourceId: 'ball-1', expiresTick: 10_000, sinceTick: 0 }],
      },
      { position: { x: 800, y: 800 }, velocity: still },
    ]);

  it('takes no hit of any kind while phased: a poison tick misses then and lands when solid', () => {
    expect(POISON_INTERVAL_TICKS).toBeLessThan(PHASE_TICKS);
    const phased = play(poisoned(0), POISON_INTERVAL_TICKS);
    expect(damageTo(phased.events, 'ball-0')).toStrictEqual([]);
    expect(ghostOf(phased.world)?.health).toBe(ghost.maxHealth);
    // Solid all the way through the first interval.
    const solid = play(poisoned(PHASE_TICKS), POISON_INTERVAL_TICKS);
    expect(damageTo(solid.events, 'ball-0').map((event) => event.amount)).toStrictEqual([
      POISON_DAMAGE,
    ]);
  });

  /** The Ghost and red heading at each other along y = 500, the Ghost held phased or solid. */
  const meeting = (phase: number): WorldState =>
    withBalls(createWorld(1, [ghost, red]), [
      {
        position: { x: 300, y: 500 },
        velocity: { x: ghost.speed, y: 0 },
        abilityState: { phase, phased: phasedAt(0, phase) },
      },
      { position: { x: 700, y: 500 }, velocity: { x: -red.speed, y: 0 } },
    ]);

  it('passes through a ball while phased and hits it once for its spectral hit, taking nothing', () => {
    const { world, events } = play(meeting(0), 40);
    const contacts = ofType(events, 'collision');
    expect(contacts.map((event) => event.phased)).toStrictEqual([true]);
    expect(damageTo(events, 'ball-1').map((event) => [event.amount, event.via])).toStrictEqual([
      [SPECTRAL_HIT, 'onHitBall'],
    ]);
    expect(ghostOf(world)?.health).toBe(ghost.maxHealth);
    // Through and out the other side, still going the way it went.
    expect(ghostOf(world)?.position.x ?? 0).toBeGreaterThan(world.balls[1]?.position.x ?? 0);
  });

  it('bumps as usual while solid, with no spectral hit', () => {
    const { events } = play(meeting(PHASE_TICKS), 40);
    expect(ofType(events, 'collision').map((event) => event.phased)).toStrictEqual([undefined]);
    const hits = damageTo(events, 'ball-1');
    expect(hits.map((event) => event.cause)).toStrictEqual(['contact']);
    expect(damageTo(events, 'ball-0')).toHaveLength(1);
  });
});

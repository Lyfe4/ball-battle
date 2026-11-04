// Headless match running and aggregation for `pnpm balance`. Uses the real simulation.
import { indexDefinitions } from '../src/sim/definitions.ts';
import { MATCH_TIME_LIMIT_TICKS, TICK_RATE } from '../src/sim/constants.ts';
import { step } from '../src/sim/step.ts';
import type { BallDefinition, DefinitionLookup, SimEvent, WorldState } from '../src/sim/types.ts';
import { createWorld } from '../src/sim/world.ts';

/** What one ball did over one or more matches. */
export interface BallTotals {
  contactDamage: number;
  abilityDamage: number;
  healed: number;
  /**
   * Contact hits that were not clamped by the target's remaining health (no killing blows or
   * tiebreak survivals), and their total damage: the effective per-hit damage, used to check that
   * a ±5% stat change survives rounding.
   */
  unclampedHits: number;
  unclampedHitDamage: number;
}

export interface PairResult {
  /** Wins for the first and second ball of the pair, whichever slot they played in. */
  readonly wins: [number, number];
  draws: number;
  games: number;
  readonly lengths: number[];
  readonly totals: [BallTotals, BallTotals];
}

const emptyTotals = (): BallTotals => ({
  contactDamage: 0,
  abilityDamage: 0,
  healed: 0,
  unclampedHits: 0,
  unclampedHitDamage: 0,
});

function addEvents(totals: BallTotals, ballId: string, events: readonly SimEvent[]): void {
  for (const event of events) {
    if (event.type === 'damage' && event.sourceId === ballId) {
      if (event.cause === 'ability') {
        totals.abilityDamage += event.amount;
      } else {
        totals.contactDamage += event.amount;
        if (event.healthAfter > 0 && !event.survivedLethal) {
          totals.unclampedHits++;
          totals.unclampedHitDamage += event.amount;
        }
      }
    }
    if (event.type === 'healed' && event.ballId === ballId) totals.healed += event.amount;
  }
}

function playMatch(
  a: BallDefinition,
  b: BallDefinition,
  seed: number,
  lookup: DefinitionLookup,
): { winner: 0 | 1 | 'draw'; seconds: number; events: SimEvent[] } {
  let world: WorldState = createWorld(seed, [a, b]);
  const events: SimEvent[] = [];
  // The time limit guarantees an end; the extra tick only guards against a sim bug looping forever.
  for (let i = 0; i <= MATCH_TIME_LIMIT_TICKS && world.match.status === 'running'; i++) {
    const result = step(world, lookup);
    world = result.world;
    events.push(...result.events);
  }
  if (world.match.status !== 'finished') {
    throw new Error(`${a.id} vs ${b.id}, seed ${seed}: did not finish within the time limit`);
  }
  const { result, endTick } = world.match;
  const winner = result.kind === 'draw' ? 'draw' : result.winnerId === 'ball-0' ? 0 : 1;
  return { winner, seconds: endTick / TICK_RATE, events };
}

/**
 * Plays `x` against `y` on seeds 0..seeds-1 in both slot orders, so any advantage from starting
 * on one side cancels out. For a mirror match pass the same definition twice; slot order then
 * makes no difference, so it plays only once per seed.
 */
export function playPair(
  x: BallDefinition,
  y: BallDefinition,
  seeds: number,
  roster: readonly BallDefinition[],
): PairResult {
  const lookup = indexDefinitions([
    ...roster.filter((ball) => ball.id !== x.id && ball.id !== y.id),
    x,
    y,
  ]);
  const result: PairResult = {
    wins: [0, 0],
    draws: 0,
    games: 0,
    lengths: [],
    totals: [emptyTotals(), emptyTotals()],
  };
  const orders =
    x === y
      ? [[0, 1] as const]
      : ([
          [0, 1],
          [1, 0],
        ] as const);
  const balls = [x, y] as const;
  for (const [first, second] of orders) {
    for (let seed = 0; seed < seeds; seed++) {
      const match = playMatch(balls[first], balls[second], seed, lookup);
      result.games++;
      result.lengths.push(match.seconds);
      if (match.winner === 'draw') result.draws++;
      else result.wins[match.winner === 0 ? first : second]++;
      addEvents(result.totals[first], 'ball-0', match.events);
      addEvents(result.totals[second], 'ball-1', match.events);
    }
  }
  return result;
}

/** A copy of the definition with its contact damage scaled, for sensitivity runs. */
export function withContactDamage(definition: BallDefinition, factor: number): BallDefinition {
  return { ...definition, contactDamage: definition.contactDamage * factor };
}

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((x, y) => x - y);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

export function averageHit(totals: BallTotals): number {
  return totals.unclampedHits === 0 ? 0 : totals.unclampedHitDamage / totals.unclampedHits;
}

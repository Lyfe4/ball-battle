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
});

function addEvents(totals: BallTotals, ballId: string, events: readonly SimEvent[]): void {
  for (const event of events) {
    if (event.type === 'damage' && event.sourceId === ballId) {
      if (event.cause === 'ability') {
        totals.abilityDamage += event.amount;
      } else {
        totals.contactDamage += event.amount;
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
  totals: readonly [BallTotals, BallTotals],
): { winner: 0 | 1 | 'draw'; seconds: number } {
  let world: WorldState = createWorld(seed, [a, b]);
  // The time limit guarantees an end; the extra tick only guards against a sim bug looping forever.
  for (let i = 0; i <= MATCH_TIME_LIMIT_TICKS && world.match.status === 'running'; i++) {
    const result = step(world, lookup);
    world = result.world;
    // Tallied tick by tick rather than collecting the whole match's events: same sums, far less
    // memory traffic, which is what limits running many matches in parallel.
    addEvents(totals[0], 'ball-0', result.events);
    addEvents(totals[1], 'ball-1', result.events);
  }
  if (world.match.status !== 'finished') {
    throw new Error(`${a.id} vs ${b.id}, seed ${seed}: did not finish within the time limit`);
  }
  const { result, endTick } = world.match;
  const winner = result.kind === 'draw' ? 'draw' : result.winnerId === 'ball-0' ? 0 : 1;
  return { winner, seconds: endTick / TICK_RATE };
}

/**
 * Plays `x` against `y` on seeds firstSeed..seeds-1 in both slot orders, so any advantage from starting
 * on one side cancels out. For a mirror match pass the same definition twice; slot order then
 * makes no difference, so it plays only once per seed.
 */
export function playPair(
  x: BallDefinition,
  y: BallDefinition,
  seeds: number,
  roster: readonly BallDefinition[],
  firstSeed = 0,
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
    for (let seed = firstSeed; seed < seeds; seed++) {
      const match = playMatch(balls[first], balls[second], seed, lookup, [
        result.totals[first],
        result.totals[second],
      ]);
      result.games++;
      result.lengths.push(match.seconds);
      if (match.winner === 'draw') result.draws++;
      else result.wins[match.winner === 0 ? first : second]++;
    }
  }
  return result;
}

/**
 * A copy of the definition with its max health scaled, for sensitivity runs. Rounded, because
 * health is a whole number everywhere in the sim; the caller reports the effective change.
 * Health is used rather than damage so every damage source (contact, arrows, zones) is nudged by
 * the same amount.
 */
export function withMaxHealth(definition: BallDefinition, factor: number): BallDefinition {
  return { ...definition, maxHealth: Math.round(definition.maxHealth * factor) };
}

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((x, y) => x - y);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/**
 * Combines results for the same pair played on different seed ranges. Every field is a count, a
 * whole-number sum or a list of lengths (only ever used through median), so the merged result is
 * exactly what one run over all the seeds gives.
 */
export function mergePairResults(parts: readonly PairResult[]): PairResult {
  const merged: PairResult = {
    wins: [0, 0],
    draws: 0,
    games: 0,
    lengths: [],
    totals: [emptyTotals(), emptyTotals()],
  };
  for (const part of parts) {
    merged.wins[0] += part.wins[0];
    merged.wins[1] += part.wins[1];
    merged.draws += part.draws;
    merged.games += part.games;
    merged.lengths.push(...part.lengths);
    for (const index of [0, 1] as const) {
      merged.totals[index].contactDamage += part.totals[index].contactDamage;
      merged.totals[index].abilityDamage += part.totals[index].abilityDamage;
      merged.totals[index].healed += part.totals[index].healed;
    }
  }
  return merged;
}

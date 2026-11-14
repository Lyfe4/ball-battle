// Known match results (ADR 0023): a fixed set of matchups and seeds, each played to its end and
// recorded as its winner, end tick and a hash of the final world and every event. The committed
// record (`golden-matches.json`) is checked in Node and in Chromium, Firefox and WebKit, so a change
// that is deterministic but different, or an engine that computes a different fight, fails with the
// match it changed. It lives outside src/sim because it hashes with Web Crypto; it only reads the sim.
import { PAIRS } from '../sim/balls/roster-support.ts';
import * as sim from '../sim/index.ts';
import type { SimEvent, WorldState } from '../sim/index.ts';

export interface GoldenCase {
  readonly a: string;
  readonly b: string;
  readonly seed: number;
}

export interface GoldenResult extends GoldenCase {
  /** The winner's slot id (`ball-0` is `a`, `ball-1` is `b`), or "draw". */
  readonly winner: string;
  readonly endTick: number;
  /** SHA-256 of the final world and every event, as canonical JSON. */
  readonly hash: string;
}

export interface GoldenRecord {
  readonly ruleset: number;
  readonly results: readonly GoldenResult[];
}

/** Seeds per pair. Spread over the whole 32-bit range, with both ends included. */
const SEEDS_PER_PAIR = 2;

/** Seed `n`, spread over 0..2^32-1 by Knuth's multiplicative hash; the first and last are fixed. */
function seedAt(n: number, count: number): number {
  if (n === 0) return 0;
  if (n === count - 1) return 0xffff_ffff;
  return Math.imul(n, 0x9e37_79b1) >>> 0;
}

/** Every pair of balls once, mirrors included, at two seeds each. */
export const GOLDEN_CASES: readonly GoldenCase[] = PAIRS.flatMap(([a, b], pair) =>
  Array.from({ length: SEEDS_PER_PAIR }, (_, k) => ({
    a: a.id,
    b: b.id,
    seed: seedAt(pair * SEEDS_PER_PAIR + k, PAIRS.length * SEEDS_PER_PAIR),
  })),
);

/**
 * JSON with -0 kept distinct from 0. Number formatting and key order are fixed by the language
 * spec, so the text is the same on every engine whenever the values are.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => (Object.is(v, -0) ? '-0' : v));
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * What playing a case needs from a sim: today's (`src/sim/index.ts`) or a frozen ruleset's bundle
 * (`rulesets/`), which exposes the same functions.
 */
export interface GoldenSim {
  createWorld(seed: number, a: string, b: string): WorldState;
  step(world: WorldState): { readonly world: WorldState; readonly events: readonly SimEvent[] };
}

/** Plays one case to its end, collecting every event. Every match ends (ADR 0002). */
function play(golden: GoldenCase, on: GoldenSim): { world: WorldState; events: SimEvent[] } {
  let world = on.createWorld(golden.seed, golden.a, golden.b);
  const events: SimEvent[] = [];
  while (world.match.status === 'running') {
    const next = on.step(world);
    world = next.world;
    events.push(...next.events);
  }
  return { world, events };
}

/** Plays one case to its end and records it. */
export async function playGolden(golden: GoldenCase, on: GoldenSim = sim): Promise<GoldenResult> {
  const { world, events } = play(golden, on);
  if (world.match.status !== 'finished') {
    throw new Error(`${golden.a} v ${golden.b}, seed ${golden.seed}: the match did not end`);
  }
  const { result, endTick } = world.match;
  return {
    ...golden,
    winner: result.kind === 'win' ? result.winnerId : 'draw',
    endTick,
    hash: await sha256(canonicalJson({ world, events })),
  };
}

/** Plays the cases with a sim (today's unless named), in order. */
export async function playGoldenCases(
  cases: readonly GoldenCase[],
  on: GoldenSim = sim,
): Promise<GoldenResult[]> {
  const results: GoldenResult[] = [];
  for (const { a, b, seed } of cases) results.push(await playGolden({ a, b, seed }, on));
  return results;
}

/** Plays every golden case under today's rules. */
export async function computeGolden(): Promise<GoldenRecord> {
  return { ruleset: sim.RULESET_VERSION, results: await playGoldenCases(GOLDEN_CASES) };
}

/** One line per result that differs from the record: which match, and what changed. */
export function describeDifferences(
  expected: readonly GoldenResult[],
  actual: readonly GoldenResult[],
): string[] {
  const lines: string[] = [];
  if (expected.length !== actual.length) {
    lines.push(`${actual.length} results, the record has ${expected.length}`);
  }
  actual.forEach((got, i) => {
    const want = expected[i];
    if (want === undefined) return;
    const match = `${got.a} v ${got.b}, seed ${got.seed}`;
    if (want.a !== got.a || want.b !== got.b || want.seed !== got.seed) {
      lines.push(
        `case ${i}: played ${match}, the record has ${want.a} v ${want.b}, seed ${want.seed}`,
      );
    } else if (canonicalJson(want) !== canonicalJson(got)) {
      lines.push(
        `case ${i} (${match}): winner ${got.winner} at tick ${got.endTick}, hash ${got.hash}; ` +
          `the record has ${want.winner} at tick ${want.endTick}, hash ${want.hash}`,
      );
    }
  });
  return lines;
}

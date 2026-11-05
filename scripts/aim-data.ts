// Reading the raw JSON written by aim-measure.ts into the shapes the report needs.
import { readFileSync } from 'node:fs';
import { add, EMPTY, fold, mirrorIndex, margin, tallyOf, type Tally } from './aim-analysis.ts';
import { DIRECTIONS, type AimResult } from './aim-play.ts';

export interface Row {
  readonly label: Readonly<Record<string, string | number>>;
  readonly result: AimResult;
}

export function readRows(file: string): readonly Row[] {
  return (JSON.parse(readFileSync(file, 'utf8')) as { rows: Row[] }).rows;
}

const key = (...parts: readonly (string | number)[]) => parts.join('|');

/** A lookup from label values to tallies, from P's side. */
export function index(rows: readonly Row[], fields: readonly string[]): Map<string, Tally> {
  const map = new Map<string, Tally>();
  for (const { label, result } of rows) {
    const k = key(...fields.map((field) => label[field] ?? ''));
    map.set(k, add(map.get(k) ?? EMPTY, tallyOf(result)));
  }
  return map;
}

export const get = (map: Map<string, Tally>, ...parts: readonly (string | number)[]) =>
  map.get(key(...parts)) ?? EMPTY;

/**
 * Folded per-direction tallies for P against Q on each seed half, and the reference for each half:
 * every direction together. Random aim's expected rate is the average over evenly spaced
 * directions, and the sum has 24 times the games of the measured random aim, so it adds far less
 * noise to a gain. The measured random aim is returned too, as a cross-check.
 */
export function directionHalves(map: Map<string, Tally>, p: string, q: string) {
  const unfolded = (h: number) =>
    Array.from({ length: DIRECTIONS }, (_, k) => get(map, p, q, k, h));
  const everyDirection = (h: number) => unfolded(h).reduce(add, EMPTY);
  return {
    halves: [fold(unfolded(0)), fold(unfolded(1))] as const,
    reference: [everyDirection(0), everyDirection(1)] as const,
    measuredRandom: add(get(map, p, q, 'random', 0), get(map, p, q, 'random', 1)),
  };
}

/**
 * The 24 x 24 payoff matrix for P (wins minus losses per game), each cell merged with its mirror
 * image (both sides turning the other way), which is the same situation reflected top to bottom.
 */
export function payoffMatrix(map: Map<string, Tally>, p: string, q: string): number[][] {
  return Array.from({ length: DIRECTIONS }, (_, i) =>
    Array.from({ length: DIRECTIONS }, (_, j) =>
      margin(
        add(
          get(map, p, q, i, j),
          get(map, p, q, mirrorIndex(i, DIRECTIONS), mirrorIndex(j, DIRECTIONS)),
        ),
      ),
    ),
  );
}

/** Weights over the 24 directions for "folded direction k", split evenly between ±θ. */
export function foldedWeights(k: number): number[] {
  const weights = new Array<number>(DIRECTIONS).fill(0);
  const mirror = mirrorIndex(k, DIRECTIONS);
  weights[k] = mirror === k ? 1 : 0.5;
  weights[mirror] = mirror === k ? 1 : 0.5;
  return weights;
}

export const oneHot = (k: number): number[] =>
  Array.from({ length: DIRECTIONS }, (_, index) => (index === k ? 1 : 0));

// The bundle's size budget (2026-11-27), checked with the bundle's contents (check-bundle.ts) in
// `pnpm build` and `pnpm build:online`, so CI's build job holds it with no job of its own. Sizes
// are gzipped, as a phone downloads them. Measured the day it was set: the online build's scripts
// 152 kB and stylesheets 22.5 kB (production's 118 kB and 22.5 kB); the budget leaves room for a few
// features, and a change past it says by how much, so splitting a rarely used screen out (or
// raising the budget, in the pull request that needs it, saying why) is a decision, not a drift.
import { gzipSync } from 'node:zlib';

/** Gzipped bytes allowed for all of a build's scripts, and for all of its stylesheets. */
export const BUDGET = { scripts: 180 * 1024, styles: 28 * 1024 } as const;

export interface BundledFile {
  readonly name: string;
  readonly text: string;
}

export const gzipped = (text: string): number => gzipSync(text).length;

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} kB`;

/** Each kind's total against its budget: a line per kind over it. */
export function budgetProblems(files: readonly BundledFile[]): string[] {
  const total = (pattern: RegExp) =>
    files
      .filter((file) => pattern.test(file.name))
      .reduce((sum, file) => sum + gzipped(file.text), 0);
  const scripts = total(/\.js$/);
  const styles = total(/\.css$/);
  const problems: string[] = [];
  if (scripts > BUDGET.scripts) {
    problems.push(`scripts are ${kb(scripts)} gzipped, over the ${kb(BUDGET.scripts)} budget`);
  }
  if (styles > BUDGET.styles) {
    problems.push(`stylesheets are ${kb(styles)} gzipped, over the ${kb(BUDGET.styles)} budget`);
  }
  return problems;
}

/** One line for the build's log: what each kind weighs now. */
export function budgetLine(files: readonly BundledFile[]): string {
  const sum = (pattern: RegExp) =>
    files
      .filter((file) => pattern.test(file.name))
      .reduce((total, file) => total + gzipped(file.text), 0);
  return `scripts ${kb(sum(/\.js$/))} of ${kb(BUDGET.scripts)}, stylesheets ${kb(sum(/\.css$/))} of ${kb(BUDGET.styles)} (gzipped)`;
}

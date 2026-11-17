import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BALLS } from '../src/sim/balls/index.ts';
import { RULESET_VERSION } from '../src/sim/ruleset.ts';

// The committed summary must describe this build's rules. Ruleset 19's summary was written while
// the code still said 18 (regenerated before the bump in the same commit), so its header named the
// wrong ruleset for numbers that already included the Slime. Regenerate after the bump.
const summary = readFileSync(new URL('../docs/balance-summary.md', import.meta.url), 'utf8');

describe('docs/balance-summary.md', () => {
  it('names the current ruleset: run `pnpm balance:summary` after bumping RULESET_VERSION', () => {
    expect(summary).toMatch(new RegExp(`^Ruleset ${String(RULESET_VERSION)},`, 'm'));
  });

  it('has a row for every ball in the roster, in roster order', () => {
    const rows = [...summary.matchAll(/^\| (\S[^|]*?) +\| +\d+\.\d%/gm)].map((m) => m[1]);
    expect(rows).toEqual(BALLS.map((ball) => ball.name));
  });
});

// The known match results (ADR 0023). Runs in the unit suite under Node and, unchanged, in
// Chromium, Firefox and WebKit (`pnpm test:browsers`), so every engine must play every recorded
// match to the same end, tick and hash.
import { describe, expect, it } from 'vitest';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { computeGolden, describeDifferences, GOLDEN_CASES, type GoldenRecord } from './golden.ts';
import record from './golden-matches.json';

const golden: GoldenRecord = record;

describe('the known match results', () => {
  it("were recorded under today's ruleset", () => {
    expect(
      golden.ruleset,
      'RULESET_VERSION changed: run pnpm golden to record the new results (ADR 0023)',
    ).toBe(RULESET_VERSION);
  });

  it('cover every case', () => {
    expect(golden.results.map(({ a, b, seed }) => ({ a, b, seed }))).toStrictEqual(GOLDEN_CASES);
  });

  it('are what this engine plays', { timeout: 60_000 }, async () => {
    const { results } = await computeGolden();
    expect(
      describeDifferences(golden.results, results),
      'A recorded match plays differently. If the rules changed on purpose, bump RULESET_VERSION ' +
        'and run pnpm golden; if not, this engine or a refactor changed a fight (ADR 0023)',
    ).toStrictEqual([]);
  });
});

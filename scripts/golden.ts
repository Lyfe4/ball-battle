// `pnpm golden`: regenerates src/golden/golden-matches.json, the known match results (ADR 0023).
// Run it after bumping RULESET_VERSION. It refuses to rewrite the record under the same ruleset
// version: results that change without a bump mean the rules changed by accident (or an engine
// computes differently), and that has to be looked at, not recorded.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { computeGolden, describeDifferences, type GoldenRecord } from '../src/golden/golden.ts';

const path = fileURLToPath(new URL('../src/golden/golden-matches.json', import.meta.url));

function readRecord(): GoldenRecord | undefined {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as GoldenRecord;
  } catch {
    return undefined;
  }
}

const previous = readRecord();
const next = await computeGolden();

if (previous?.ruleset === next.ruleset) {
  const differences = describeDifferences(previous.results, next.results);
  if (differences.length === 0) {
    console.log(`golden-matches.json is current for ruleset ${next.ruleset}; nothing to do.`);
    process.exit(0);
  }
  console.error(
    `Results changed without a ruleset bump (still ${next.ruleset}). Bump RULESET_VERSION in ` +
      'src/sim/ruleset.ts if the change is intended (ADR 0022), then run pnpm golden again.\n' +
      differences.slice(0, 20).join('\n'),
  );
  process.exit(1);
}

writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
console.log(
  `Wrote ${next.results.length} results for ruleset ${next.ruleset} to src/golden/golden-matches.json`,
);

// Every frozen ruleset still plays its own known results (ADR 0051 option 2, ADR 0052 "Rulesets"):
// rulesets/r<N>/sim.mjs replays rulesets/r<N>/golden.json, in Node like the server that will load
// it. A bundle that stopped reproducing its results could no longer verify the series pinned to it.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  describeDifferences,
  playGoldenCases,
  type GoldenRecord,
  type GoldenSim,
} from '../src/golden/golden.ts';
import { RULESET_VERSION } from '../src/sim/ruleset.ts';

const rulesets = fileURLToPath(new URL('../rulesets/', import.meta.url));
const frozen = existsSync(rulesets)
  ? readdirSync(rulesets)
      .filter((name) => /^r\d+$/.test(name))
      .map((name) => Number(name.slice(1)))
      .sort((x, y) => x - y)
  : [];

/** What every frozen bundle exposes, whatever its ruleset: the stable core of src/sim/index.ts. */
interface FrozenSim extends GoldenSim {
  readonly RULESET_VERSION: number;
}

const fileOf = (version: number, name: string) => `${rulesets}r${String(version)}/${name}`;

describe('the frozen rulesets', () => {
  it("include today's ruleset, so a series created now can be finished after a bump", () => {
    expect(
      frozen,
      'Run pnpm ruleset:freeze after pnpm golden, and commit rulesets/ (ADR 0052)',
    ).toContain(RULESET_VERSION);
  });

  it.each(frozen)(
    'ruleset %i plays its own known results with no import of its own',
    { timeout: 240_000 },
    async (version) => {
      const source = readFileSync(fileOf(version, 'sim.mjs'), 'utf8');
      expect(source).not.toMatch(/^\s*import\b|\bimport\s*\(/m);
      const sim = (await import(pathToFileURL(fileOf(version, 'sim.mjs')).href)) as FrozenSim;
      expect(sim.RULESET_VERSION).toBe(version);
      const record = JSON.parse(
        readFileSync(fileOf(version, 'golden.json'), 'utf8'),
      ) as GoldenRecord;
      expect(record.ruleset).toBe(version);
      const results = await playGoldenCases(record.results, sim);
      expect(describeDifferences(record.results, results)).toStrictEqual([]);
    },
  );
});

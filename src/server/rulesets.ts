// The sim a series is played by (ADR 0052, "Rulesets"): the frozen bundle of the ruleset the series
// names, `rulesets/r<N>/sim.mjs`, never the live src/sim. A series by turns lasts days and a balance
// change must not void it, and playing every series through its own bundle means the path the
// server runs is the path CI tests (`frozen-rulesets.slow.test.ts`). The server imports only the
// sim's types (ESLint): there is no live sim here to fall back to. A missing bundle is an error
// that says so.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type * as Sim from '../sim/index.ts';
import { ApiError } from './http.ts';

/** What every frozen bundle exports: src/sim/index.ts as it was at that ruleset. */
export type FrozenSim = typeof Sim;

/** The functions that every ruleset's bundle must have for the server to play a series with it. */
const REQUIRED = [
  'awaitingPick',
  'decodeSeriesSetup',
  'matchWorld',
  'nextMatch',
  'outcomeOf',
  'playToEnd',
  'recordOutcome',
  'recordPick',
  'remainingOf',
  'setupWithPicks',
  'startSeries',
  'verifySeries',
] as const;

/**
 * Where the frozen rulesets are: `RULESETS_DIR`, else `rulesets/` under the working directory (the
 * repository locally and in tests; the function's root on Netlify, which `included_files` fills).
 */
export const rulesetsDir = (): string =>
  process.env['RULESETS_DIR'] ?? join(process.cwd(), 'rulesets');

const loaded = new Map<number, Promise<FrozenSim>>();

async function load(version: number, dir: string): Promise<FrozenSim> {
  const file = join(dir, `r${String(version)}`, 'sim.mjs');
  if (!existsSync(file)) {
    throw new ApiError(
      500,
      'ruleset_missing',
      `Ruleset ${String(version)} has no frozen bundle on this server`,
    );
  }
  const sim = (await import(pathToFileURL(file).href)) as Partial<FrozenSim>;
  const missing = REQUIRED.filter((name) => typeof sim[name] !== 'function');
  if (sim.RULESET_VERSION !== version || missing.length > 0) {
    throw new Error(`rulesets/r${String(version)}/sim.mjs is not ruleset ${String(version)}'s sim`);
  }
  return sim;
}

/** The frozen sim of ruleset `version`, loaded once per function instance. */
export function rulesetSim(version: number, dir = rulesetsDir()): Promise<FrozenSim> {
  if (!Number.isInteger(version) || version <= 0) {
    return Promise.reject(new Error(`No ruleset ${String(version)}`));
  }
  const key = version;
  let sim = loaded.get(key);
  if (sim === undefined) {
    sim = load(version, dir);
    // A failed load is not kept: the next request tries again (a deploy may have fixed it).
    sim.catch(() => loaded.delete(key));
    loaded.set(key, sim);
  }
  return sim;
}

/**
 * The ruleset new series are created under: the build's own (the client plays it too). Its frozen
 * bundle must exist, which `frozen-rulesets.slow.test.ts` makes sure of.
 */
export { RULESET_VERSION as CURRENT_RULESET } from './current-ruleset.ts';

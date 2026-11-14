// The sim's one public API (ADR 0051, 0052): what a server and a frozen ruleset bundle expose.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from './balls/index.ts';
import * as sim from './index.ts';
import { verifySeries as verifyWith } from './series-verify.ts';
import { indexDefinitions } from './definitions.ts';
import { blue, red } from './test-support.ts';
import type { SeriesSetup } from './series.ts';

const ids = [...BALL_LOOKUP.keys()];
const valid: SeriesSetup = {
  ruleset: sim.RULESET_VERSION,
  seed: 7,
  a: ids.slice(0, 3),
  b: sim.BOTS.get('normal')?.pickLineup(7, ids) ?? [],
  opponent: { kind: 'bot', bot: 'normal', lineupSeed: 7 },
};

describe('the sim entry file', () => {
  it('verifies a series against the game roster, whatever lookup a caller passes', () => {
    expect(sim.verifySeries(valid)).toStrictEqual(verifyWith(valid, BALL_LOOKUP));
    // The bot picks by index into the roster's order, so another lookup must not be usable.
    const other = indexDefinitions([red, blue]);
    const loose = sim.verifySeries as (raw: unknown, lookup: unknown) => sim.SeriesVerdict;
    expect(loose(valid, other).ok).toBe(true);
  });

  it('plays a match by ball ids with its own definitions', () => {
    const [a = '', b = ''] = ids;
    const end = sim.playToEnd(sim.createWorld(11, a, b));
    expect(end.match.status).toBe('finished');
    expect(() => sim.createWorld(11, a, 'not-a-ball')).toThrow('not-a-ball');
  });

  it('lists the roster in the order the bot picks from', () => {
    expect(sim.ROSTER).toStrictEqual(ids);
  });

  // A server imports the sim with Node's own type stripping, no bundler and no DOM: this is that
  // import, in a fresh Node process.
  it('loads in plain Node', () => {
    const entry = fileURLToPath(new URL('./index.ts', import.meta.url));
    const script = `const sim = await import(${JSON.stringify(`file://${entry.replaceAll('\\', '/')}`)});
      process.stdout.write(String(sim.RULESET_VERSION) + ' ' + String(sim.ROSTER.length));`;
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf8',
    });
    expect(out).toBe(`${String(sim.RULESET_VERSION)} ${String(ids.length)}`);
  });
});

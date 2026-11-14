// The server's seeds (ADR 0051 option B, ADR 0052 "Seeds"): HMAC-SHA256 of the series and purpose
// under the secret key, cut to 32 bits. The vectors were made with Node's `crypto.createHmac`, a
// different implementation from the WebCrypto one under test.
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { commitmentOf, isCommitted } from '../api/fairness.ts';
import {
  awaitingPick,
  botFor,
  botPick,
  BOTS,
  matchWorld,
  nextMatch,
  outcomeOf,
  playToEnd,
  recordOutcome,
  recordPick,
  remainingOf,
  RULESET_VERSION,
  ROSTER,
  setupWithPicks,
  startSeries,
  verifySeries,
  type SeriesSetup,
  type SeriesState,
} from '../sim/index.ts';
import { importSeedKey, newSalt, seedFor, seriesSeeds } from './seeds.ts';

const KEY = Uint8Array.from({ length: 32 }, (_, i) => i);
const SERIES = '0f8fad5b-d9cb-469f-a165-70867728950e';
const VECTORS = [
  { purpose: 'round', index: 0, seed: 2698050428 },
  { purpose: 'round', index: 4, seed: 3683812211 },
  { purpose: 'toss', index: 0, seed: 4281148587 },
  { purpose: 'lineup', index: 0, seed: 2769564294 },
  { purpose: 'bot', index: 0, seed: 3606771991 },
] as const;

/** Plays a series as the game does: the bot picks for side B, side A takes its first ball left. */
function playAsTheGame(setup: SeriesSetup): SeriesState {
  let state = startSeries(setup);
  for (;;) {
    const due = awaitingPick(state);
    const pick = due === 'b' ? botPick(botFor(setup.opponent), state) : remainingOf(state, 'a')[0];
    if (due !== undefined && pick !== undefined) {
      state = recordPick(state, pick);
      continue;
    }
    const match = nextMatch(state);
    if (match === undefined) return state;
    const end = playToEnd(matchWorld(match));
    if (end.match.status !== 'finished') throw new Error('Unfinished match');
    state = recordOutcome(state, outcomeOf(end.match.result, end));
  }
}

function nodeSeed(purpose: string, index: number, key = KEY, series = SERIES): number {
  const message = `ballbattle/seed/v1\0${series}\0${purpose}\0${String(index)}`;
  return createHmac('sha256', key).update(message).digest().readUInt32BE(0);
}

describe('the server seeds', () => {
  it('match the published vectors and Node crypto', async () => {
    const key = await importSeedKey(KEY);
    for (const { purpose, index, seed } of VECTORS) {
      expect(nodeSeed(purpose, index)).toBe(seed);
      expect(await seedFor(key, SERIES, purpose, index)).toBe(seed);
    }
  });

  it('differ by key, series, purpose and round', async () => {
    const other = Uint8Array.from(KEY, (byte) => byte ^ 1);
    const seeds = new Set([
      await seedFor(await importSeedKey(KEY), SERIES, 'round', 0),
      await seedFor(await importSeedKey(other), SERIES, 'round', 0),
      await seedFor(await importSeedKey(KEY), SERIES.replace('0f', '1f'), 'round', 0),
      await seedFor(await importSeedKey(KEY), SERIES, 'round', 1),
      await seedFor(await importSeedKey(KEY), SERIES, 'toss', 0),
    ]);
    expect(seeds.size).toBe(5);
  });

  it('refuse a short key, a series id that is not a lowercase UUID, or an index out of range', async () => {
    await expect(importSeedKey(KEY.slice(1))).rejects.toThrow('32 bytes');
    const key = await importSeedKey(KEY);
    for (const id of ['', SERIES.toUpperCase(), `${SERIES}\0round`, 'x'.repeat(36)]) {
      await expect(seedFor(key, id, 'round', 0)).rejects.toThrow('UUID');
    }
    for (const index of [-1, 5, 1.5]) {
      await expect(seedFor(key, SERIES, 'round', index)).rejects.toThrow('index');
    }
    await expect(seedFor(key, SERIES, 'toss', 1)).rejects.toThrow('index');
  });

  it('give a series exactly the seeds it uses, which it verifies with', async () => {
    const key = await importSeedKey(KEY);
    const bot = BOTS.get('hard');
    if (bot === undefined) throw new Error('No Hard bot');
    const planned = await seriesSeeds(key, SERIES, { bestOf: 3, format: 'reveal', bot: true });
    expect(planned.seeds).toStrictEqual({
      rounds: [VECTORS[0].seed, nodeSeed('round', 1), nodeSeed('round', 2)],
      toss: VECTORS[2].seed,
      bot: VECTORS[4].seed,
    });
    expect(planned.lineupSeed).toBe(VECTORS[3].seed);
    const setup: SeriesSetup = {
      ruleset: RULESET_VERSION,
      seed: 0,
      a: ROSTER.slice(0, 3),
      b: bot.pickLineup(planned.lineupSeed ?? 0, ROSTER),
      opponent: { kind: 'bot', bot: bot.id, lineupSeed: planned.lineupSeed ?? 0 },
      format: 'reveal',
      seeds: planned.seeds,
    };
    expect(verifySeries(setupWithPicks(playAsTheGame(setup))).ok).toBe(true);
    const player = await seriesSeeds(key, SERIES, { bestOf: 5, format: 'blind', bot: false });
    const rounds = [0, 1, 2, 3, 4].map((round) => nodeSeed('round', round));
    expect(player).toStrictEqual({ seeds: { rounds } });
  });

  it('salt each seed with 16 fresh random bytes that its commitment checks', async () => {
    const salts = new Set(Array.from({ length: 100 }, newSalt));
    expect(salts.size).toBe(100);
    for (const salt of salts) expect(salt).toMatch(/^[0-9a-f]{32}$/);
    const salt = newSalt();
    const commitment = await commitmentOf(VECTORS[0].seed, salt);
    expect(await isCommitted({ seed: VECTORS[0].seed, salt, commitment })).toBe(true);
  });
});

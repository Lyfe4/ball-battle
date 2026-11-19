// Older rulesets this build still replays (ADR 0073, `SAME_FIGHTS_AS`): a series or link played
// under one must verify and replay exactly as it was played. Two halves of the proof:
// - its fights are today's: its frozen known results are today's, match for match;
// - its bots are kept: series that its own frozen bundle plays against every bot, in every format
//   and length, verify here and reach the same rounds, though today's bots would choose otherwise.
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import type * as Sim from '../src/sim/index.ts';
import { ROSTER, verifySeries } from '../src/sim/index.ts';
import { RULESET_VERSION, SAME_FIGHTS_AS } from '../src/sim/ruleset.ts';
import type { BestOf, Format, SeriesSetup, SeriesState } from '../src/sim/series.ts';
import type { GoldenRecord } from '../src/golden/golden.ts';

const rulesets = fileURLToPath(new URL('../rulesets/', import.meta.url));
const read = (path: string) => readFileSync(path, 'utf8');
const today = JSON.parse(
  read(fileURLToPath(new URL('../src/golden/golden-matches.json', import.meta.url))),
) as GoldenRecord;

const FORMATS: readonly (Format | undefined)[] = [undefined, 'reveal', 'showdown'];
const LENGTHS: readonly (BestOf | undefined)[] = [undefined, 5];
const BOT_IDS = ['easy', 'normal', 'hard', 'random'] as const;
const SEEDS = 12;

/** A series as the old bundle's game plays it: its bot picks side B, side A varies with the seed. */
function playWith(sim: typeof Sim, base: SeriesSetup): SeriesState {
  const bot = sim.BOTS.get(base.opponent.kind === 'bot' ? base.opponent.bot : '');
  if (bot === undefined) throw new Error('No bot');
  let state = sim.startSeries(base);
  for (;;) {
    const due = sim.awaitingPick(state);
    if (due !== undefined) {
      const left = sim.remainingOf(state, due);
      const ball =
        due === 'b'
          ? sim.botPick(bot, state)
          : left[(base.seed + state.picks.length) % left.length];
      if (ball === undefined) throw new Error('No pick');
      state = sim.recordPick(state, ball);
      continue;
    }
    const next = sim.nextMatch(state);
    if (next === undefined) return state;
    const end = sim.playToEnd(sim.matchWorld(next));
    if (end.match.status !== 'finished') throw new Error('Unfinished match');
    state = sim.recordOutcome(state, sim.outcomeOf(end.match.result, end));
  }
}

describe.each(SAME_FIGHTS_AS)('ruleset %i, replayed by this build', (version) => {
  it('is an older ruleset than today’s', () => {
    expect(version).toBeLessThan(RULESET_VERSION);
  });

  it('has today’s fights: its frozen known results are today’s, match for match', () => {
    const frozen = JSON.parse(read(`${rulesets}r${String(version)}/golden.json`)) as GoldenRecord;
    expect(frozen.ruleset).toBe(version);
    expect(frozen.results).toStrictEqual(today.results);
  });

  it(
    'verifies every series its own bundle plays against its bots, with the same rounds',
    { timeout: 600_000 },
    async () => {
      const sim = (await import(
        pathToFileURL(`${rulesets}r${String(version)}/sim.mjs`).href
      )) as typeof Sim;
      expect(sim.RULESET_VERSION).toBe(version);
      let todaysBotsDiffer = 0;
      let played = 0;
      for (const bot of BOT_IDS) {
        for (const format of FORMATS) {
          for (const bestOf of LENGTHS) {
            for (let seed = 0; seed < SEEDS; seed++) {
              const size = bestOf ?? 3;
              const lineupSeed = seed * 31 + 7;
              const a = ROSTER.slice((seed * 3) % (ROSTER.length - size)).slice(0, size);
              const base: SeriesSetup = {
                ruleset: version,
                seed: seed * 1009 + size,
                a,
                b: sim.BOTS.get(bot)?.pickLineup(lineupSeed, sim.ROSTER, bestOf ?? 3) ?? [],
                opponent: { kind: 'bot', bot, lineupSeed },
                ...(format === undefined ? {} : { format }),
                ...(bestOf === undefined ? {} : { bestOf }),
              };
              const old = playWith(sim, base);
              const setup = sim.setupWithPicks(old);
              const verdict = verifySeries(setup);
              const label = `${bot} ${format ?? 'blind'} bo${String(size)} seed ${String(seed)}`;
              expect(verdict.ok ? 'ok' : verdict.reason, label).toBe('ok');
              if (verdict.ok) expect(verdict.state.rounds, label).toStrictEqual(old.rounds);
              // The same picks under today's ruleset are judged by today's bots.
              const asToday = verifySeries({ ...setup, ruleset: RULESET_VERSION });
              if (!asToday.ok) todaysBotsDiffer++;
              played++;
            }
          }
        }
      }
      expect(played).toBe(BOT_IDS.length * FORMATS.length * LENGTHS.length * SEEDS);
      // Without the kept bots, some of these series would no longer verify.
      expect(todaysBotsDiffer).toBeGreaterThan(0);
    },
  );
});

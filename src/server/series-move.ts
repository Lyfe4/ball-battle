// One move of a series on the server (ADR 0052, "A turn on the server"): from the series as loaded
// and the picks it adds, every round that needs no more picks played with the series' frozen sim,
// whose turn it is next, or the finished series verified. For a live series (ADR 0053) the move
// also carries its times: each round's fight, and when the next pick phase opens and closes.
import type { PickRecord } from '../sim/index.ts';
import { ConfigError, type Config } from './config.ts';
import type { LoadedSeries } from './db/series-record.ts';
import type { SeriesMove } from './db/series-write.ts';
import { fightTimes, pickPhase } from './live.ts';
import { dueOf, playDue, stateOf, turnOf, verifyFinished, type StoredSeries } from './machine.ts';
import { report } from './monitor.ts';
import { rulesetSim } from './rulesets.ts';
import { importSeedKey, seriesSeeds, type SeedKey } from './seeds.ts';
import type { SeedRow } from './view.ts';

const keys = new Map<string, Promise<SeedKey>>();
export function seedKey(config: Config, id: string): Promise<SeedKey> {
  const raw = config.seedKeys.get(id);
  if (raw === undefined) throw new ConfigError(`SEED_KEYS has no key "${id}" (a series uses it)`);
  let key = keys.get(id);
  if (key === undefined) {
    key = importSeedKey(raw);
    keys.set(id, key);
  }
  return key;
}

/** The series as the machine needs it: every seed re-derived from its key, secret ones too. */
export async function storedOf(config: Config, series: LoadedSeries): Promise<StoredSeries> {
  const { seeds } = await seriesSeeds(await seedKey(config, series.keyId), series.id, {
    bestOf: series.bestOf,
    format: series.format,
    bot: false,
  });
  return {
    ruleset: series.ruleset,
    format: series.format,
    bestOf: series.bestOf,
    a: series.lineups.a,
    b: series.lineups.b,
    seeds,
    picks: series.picks,
    rounds: series.rounds,
  };
}

/** A pick a move adds; `auto` when the server made it because time ran out (live). */
export type MovePick = PickRecord & { readonly auto?: boolean };

/** When a live move happens, by the database's clock: the lock, and the start when it is one. */
export interface LiveMoment {
  readonly lockedAt: number;
  readonly startedAt?: number;
  /** The next pick phase opens no earlier than this (the first one, after Reveal's toss). */
  readonly opensFrom?: number;
}

/**
 * The move after `picks` are added: every round that needs no more picks played (their seeds
 * revealed), then whose turn it is, or the series finished through verifySeries (every seed
 * revealed) or void when that fails (a bug: the server built the series, so it is reported).
 * A live series' move (`moment`) also times its fights and the next pick phase.
 */
export async function moveOf(
  config: Config,
  series: LoadedSeries,
  picks: readonly MovePick[],
  keepDeadline: boolean,
  moment?: LiveMoment,
): Promise<SeriesMove> {
  const sim = await rulesetSim(series.ruleset);
  const stored = await storedOf(config, { ...series, picks: [...series.picks, ...picks] });
  const { state, played, ticks } = playDue(sim, stateOf(sim, stored));
  const fights =
    moment === undefined
      ? []
      : fightTimes(
          played.map((round, index) => ({ round: round.round, ticks: ticks[index] ?? [] })),
          moment.lockedAt,
          series.live?.fights.at(-1)?.endsAt ?? null,
        );
  const phase =
    moment === undefined ? undefined : pickPhase(moment.lockedAt, fights, moment.opensFrom);
  const round = (index: number) => ({
    purpose: 'round',
    index,
    seed: stored.seeds.rounds[index] ?? 0,
  });
  const live = (open: boolean): Pick<SeriesMove, 'live'> =>
    moment === undefined
      ? {}
      : {
          live: {
            opensAt: open ? (phase?.opensAt ?? null) : null,
            deadline: open ? (phase?.deadline ?? null) : null,
            startedAt: moment.startedAt ?? null,
            fights,
          },
        };
  if (state.winner === undefined) {
    return {
      turn: turnOf(dueOf(sim, { ...stored, rounds: state.rounds }, state).sides) ?? null,
      keepDeadline: keepDeadline && played.length === 0,
      status: 'open',
      winner: null,
      final: null,
      picks,
      rounds: played,
      reveals: played.map(({ round: index }) => round(index)),
      ...live(true),
    };
  }
  const verdict = verifyFinished(sim, state);
  if (!verdict.ok) {
    await report(new Error(`Series ${series.id} failed verification: ${verdict.reason}`), {
      route: 'series.advance',
      requestId: series.id,
    });
  }
  const toss = stored.seeds.toss;
  return {
    turn: null,
    keepDeadline: false,
    status: verdict.ok ? 'finished' : 'void',
    winner: verdict.ok ? state.winner : null,
    final: verdict.ok ? verdict.setup : null,
    picks,
    rounds: played,
    // The series is over: every seed it had is public now, played or not.
    reveals: [
      ...stored.seeds.rounds.map((_, index) => round(index)),
      ...(toss === undefined ? [] : [{ purpose: 'toss', index: 0, seed: toss }]),
    ],
    ...live(false),
  };
}

/** The series as stored after `move` was written at `version`, without reading it again. */
export function after(
  series: LoadedSeries,
  move: SeriesMove,
  written: { readonly version: number; readonly deadline: Date | null },
): LoadedSeries {
  const revealed = (seed: SeedRow): SeedRow => {
    const shown = move.reveals.find((r) => r.purpose === seed.purpose && r.index === seed.index);
    return seed.seed !== null || shown === undefined ? seed : { ...seed, seed: shown.seed };
  };
  const clock = series.live;
  const timing = move.live;
  return {
    ...series,
    turn: move.turn,
    deadline: written.deadline,
    status: move.status,
    winner: move.winner,
    final: move.final,
    version: written.version,
    expired: false,
    picks: [...series.picks, ...move.picks.map(({ round, side, ball }) => ({ round, side, ball }))],
    rounds: [...series.rounds, ...move.rounds],
    seeds: series.seeds.map(revealed),
    live:
      clock === null || timing === undefined
        ? clock
        : {
            ...clock,
            startedAt: clock.startedAt ?? timing.startedAt,
            opensAt: move.keepDeadline ? clock.opensAt : timing.opensAt,
            fights: [...clock.fights, ...timing.fights],
            auto: [
              ...clock.auto,
              ...move.picks
                .filter((p) => p.auto === true)
                .map(({ round, side }) => ({ round, side })),
            ],
          },
  };
}

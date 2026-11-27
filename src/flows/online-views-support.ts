// A live series and its rematch as the API answers them, for the flows that open online screens
// with the test's own answers (online-looks-support.ts, watch-again): every round played from real
// seeds, each revealed against a real commitment, so the fair-play check passes (ADR 0051).
import { commitmentOf } from '../api/fairness.ts';
import { attemptWatchMs } from '../api/live.ts';
import type { RematchView } from '../api/rematch.ts';
import type { SeriesView } from '../api/series.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import type { SeriesSetup, Side } from '../sim/series.ts';
import { matchWorld, playSeries, playToEnd } from '../sim/series-verify.ts';

const SETUP: SeriesSetup = {
  ruleset: RULESET_VERSION,
  seed: 0,
  a: ['archer', 'thorns', 'vampire'],
  b: ['brawler', 'magnet', 'frost'],
  opponent: { kind: 'player' },
  seeds: { rounds: [101, 202, 303] },
};

/**
 * A live Blind series as side A sees it: its first round under way, or every round over; under
 * `ruleset` (an older one's fights don't replay here, ADR 0088).
 */
export async function liveSeries(
  id: string,
  over: boolean,
  now: number,
  ruleset = RULESET_VERSION,
): Promise<SeriesView> {
  const played = playSeries(SETUP, BALL_LOOKUP);
  const rounds = over ? played.rounds : played.rounds.slice(0, 1);
  let at = over ? now - 600_000 : now - 1_500;
  const fights = rounds.map((record) => {
    const fightAt = at;
    const endsAt = record.seeds.reduce((end, seed, attempt) => {
      const world = matchWorld(
        { round: record.round, attempt, seed, a: record.a, b: record.b },
        BALL_LOOKUP,
      );
      return end + attemptWatchMs(playToEnd(world, BALL_LOOKUP).tick);
    }, fightAt);
    at = endsAt + 10_000;
    return { round: record.round, fightAt, endsAt };
  });
  // Each round's seed, revealed against a real commitment, so fair play checks out (ADR 0051).
  const salt = '0f'.repeat(16);
  // At the end every round's seed is revealed, played or not; under way, the rounds played so far.
  const shown = (SETUP.seeds?.rounds ?? []).slice(0, over ? undefined : rounds.length);
  const seeds = await Promise.all(
    shown.map(async (seed, index) => {
      return {
        purpose: 'round' as const,
        index,
        commitment: await commitmentOf(seed, salt),
        seed,
        salt,
      };
    }),
  );
  return {
    id,
    kind: 'friend',
    ruleset,
    format: 'blind',
    bestOf: 3,
    you: 'a',
    names: { a: 'robin_b', b: 'Sam_R' },
    lineups: { a: SETUP.a, b: SETUP.b },
    picks: [],
    rounds,
    commitments: seeds.map(({ purpose, index, commitment }) => ({ purpose, index, commitment })),
    revealed: seeds,
    turn: null,
    deadline: null,
    status: over ? 'finished' : 'open',
    winner: over ? (played.winner ?? null) : null,
    version: 4,
    final: over ? SETUP : null,
    live: {
      startedAt: now - 700_000,
      startBy: now - 690_000,
      opensAt: null,
      fights,
      auto: [],
      away: null,
      endReason: null,
    },
  };
}

export const rematch = (
  state: RematchView['state'],
  now: number,
  askedBy: Side | null = null,
): RematchView => ({
  state,
  askedBy,
  declinedBy: state === 'declined' ? 'b' : null,
  deadline: state === 'asked' ? now + 25_000 : null,
  now,
  lineupIn: false,
  seriesId: null,
  offered: state === 'none',
  startId: null,
});

/**
 * A Reveal series by turns as side A sees it (ADR 0085): A picked round 1's ball, and it is B's
 * turn for most of a day: the waiting card in the page frame (turns-frame.ts).
 */
export const turnsSeries = (id: string, now: number): SeriesView => ({
  id,
  kind: 'friend',
  ruleset: RULESET_VERSION,
  format: 'reveal',
  bestOf: 3,
  you: 'a',
  names: { a: 'robin_b', b: 'Sam_R' },
  lineups: { a: SETUP.a, b: SETUP.b },
  picks: [{ round: 0, side: 'a', ball: SETUP.a[0] ?? 'archer' }],
  rounds: [],
  commitments: [],
  revealed: [],
  turn: 'b',
  deadline: new Date(now + 23 * 3_600_000).toISOString(),
  status: 'open',
  winner: null,
  version: 2,
  final: null,
  live: null,
});

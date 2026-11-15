import { describe, expect, it } from 'vitest';
import { commitmentOf } from '../api/fairness.ts';
import type { SeriesView } from '../api/series.ts';
import { decodeSeriesView } from '../api/series-view-decode.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { nextMatch, setupWithPicks, type SeriesSetup } from '../sim/series.ts';
import { playSeries } from '../sim/series-verify.ts';
import { dueOf, fairPlayOf, seatsOf, stateAt, timeLeft } from './online-series.ts';

const SALT = '0f'.repeat(16);

/** A finished Blind Best of 3 as the server would send it to side B. */
async function finishedView(): Promise<SeriesView> {
  const setup: SeriesSetup = {
    ruleset: RULESET_VERSION,
    seed: 0,
    a: ['archer', 'thorns', 'vampire'],
    b: ['brawler', 'magnet', 'frost'],
    opponent: { kind: 'player' },
    seeds: { rounds: [101, 202, 303] },
  };
  const state = playSeries(setup, BALL_LOOKUP);
  const revealed = await Promise.all(
    [101, 202, 303].map(async (seed, index) => ({
      purpose: 'round' as const,
      index,
      seed,
      salt: SALT,
      commitment: await commitmentOf(seed, SALT),
    })),
  );
  return {
    id: '11111111-2222-4333-8444-555555555555',
    kind: 'friend',
    ruleset: RULESET_VERSION,
    format: 'blind',
    bestOf: 3,
    you: 'b',
    names: { a: 'Player 4195', b: 'Player 6282' },
    lineups: { a: setup.a, b: setup.b },
    picks: [],
    rounds: state.rounds,
    commitments: revealed.map(({ purpose, index, commitment }) => ({ purpose, index, commitment })),
    revealed,
    turn: null,
    deadline: null,
    status: 'finished',
    winner: state.winner ?? null,
    version: 3,
    final: setupWithPicks(state),
    live: null,
  };
}

describe('an online series on the page', () => {
  it('decodes what the server sends, and refuses anything else', async () => {
    const view = await finishedView();
    expect(decodeSeriesView(JSON.parse(JSON.stringify(view)))).toStrictEqual(view);
    expect(decodeSeriesView({ ...view, you: 'c' })).toBeUndefined();
    expect(decodeSeriesView({ ...view, rounds: [{ round: 0 }] })).toBeUndefined();
    expect(decodeSeriesView(null)).toBeUndefined();
  });

  it('shows the series up to what this device watched, then plays the next round from its seed', async () => {
    const view = await finishedView();
    const before = stateAt(view, 0);
    expect(before.rounds).toStrictEqual([]);
    expect(before.winner).toBeUndefined();
    expect(nextMatch(before)?.seed).toBe(101);
    expect(stateAt(view, 99).winner).toBe(view.winner);
  });

  it('seats the player on their side, against the other player by name', async () => {
    const view = await finishedView();
    expect(seatsOf(view)).toMatchObject({ you: 'b', them: 'Player 4195' });
    expect(dueOf({ ...view, turn: 'both' })).toStrictEqual(['a', 'b']);
    expect(timeLeft('2026-11-16T00:00:00Z', Date.parse('2026-11-15T00:30:00Z'))).toBe('23 h left');
    expect(timeLeft('2026-11-15T00:40:00Z', Date.parse('2026-11-15T00:30:00Z'))).toBe(
      '10 min left',
    );
  });

  it('finds fair play when every seed matches its commitment and the replay agrees', async () => {
    expect(await fairPlayOf(await finishedView(), BALL_LOOKUP)).toBe('fair');
  });

  it('finds a seed that doesn’t match its commitment, or a round the replay doesn’t reach', async () => {
    const view = await finishedView();
    const badSeed = {
      ...view,
      revealed: view.revealed.map((seed, index) => (index === 0 ? { ...seed, seed: 102 } : seed)),
    };
    expect(await fairPlayOf(badSeed, BALL_LOOKUP)).toBe('unfair');
    const flipped = view.rounds.map((round, index) =>
      index === 0
        ? { ...round, winner: round.winner === 'a' ? ('b' as const) : ('a' as const) }
        : round,
    );
    expect(await fairPlayOf({ ...view, rounds: flipped }, BALL_LOOKUP)).toBe('unfair');
    // A server that played the whole series, consistently, on seeds it never committed to.
    const uncommitted = { ...view.final, seeds: { rounds: [1, 2, 3] } } as SeriesSetup;
    const replayed = playSeries(uncommitted, BALL_LOOKUP);
    const consistent = {
      ...view,
      final: uncommitted,
      rounds: replayed.rounds,
      winner: replayed.winner ?? null,
    };
    expect(await fairPlayOf(consistent, BALL_LOOKUP)).toBe('unfair');
    // A commitment that doesn't match its seed, everything else untouched.
    const forged = 'ab'.repeat(32);
    const badCommitment = {
      ...view,
      commitments: view.commitments.map((c, i) => (i === 0 ? { ...c, commitment: forged } : c)),
      revealed: view.revealed.map((r, i) => (i === 0 ? { ...r, commitment: forged } : r)),
    };
    expect(await fairPlayOf(badCommitment, BALL_LOOKUP)).toBe('unfair');
    expect(await fairPlayOf({ ...view, status: 'forfeit' }, BALL_LOOKUP)).toBe('unavailable');
  });
});

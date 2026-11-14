// The series machine with the frozen ruleset the server loads (never the live sim).
import { describe, expect, it } from 'vitest';
import { ApiError } from './http.ts';
import { dueOf, playDue, stateOf, turnOf, verifyFinished, type StoredSeries } from './machine.ts';
import { rulesetSim } from './rulesets.ts';

const sim = await rulesetSim(15);

const series = (over: Partial<StoredSeries> = {}): StoredSeries => ({
  ruleset: 15,
  format: 'showdown',
  bestOf: 3,
  a: ['archer', 'thorns', 'vampire'],
  b: ['brawler', 'magnet', 'frost'],
  seeds: { rounds: [11, 22, 33] },
  picks: [],
  rounds: [],
  ...over,
});

describe('the series machine', () => {
  it('lets both sides lock Showdown’s opener, in either order', () => {
    const open = series();
    expect(dueOf(sim, open, stateOf(sim, open)).sides).toStrictEqual(['a', 'b']);
    const bFirst = series({ picks: [{ round: 0, side: 'b', ball: 'frost' }] });
    const due = dueOf(sim, bFirst, stateOf(sim, bFirst));
    expect(due).toStrictEqual({ round: 0, sides: ['a'] });
    expect(turnOf(due.sides)).toBe('a');
  });

  it('plays a Blind series to its end with no picks, and it verifies', () => {
    const blind = series({ format: 'blind' });
    const { state, played } = playDue(sim, stateOf(sim, blind));
    expect(state.winner).toBeDefined();
    expect(played.length).toBeGreaterThanOrEqual(2);
    expect(verifyFinished(sim, state).ok).toBe(true);
  });

  it('rebuilds the same state from stored rounds as from playing them', () => {
    const blind = series({ format: 'blind' });
    const { state } = playDue(sim, stateOf(sim, blind));
    expect(stateOf(sim, { ...blind, rounds: state.rounds })).toStrictEqual(state);
  });

  it('refuses to finish a series whose result verifySeries doesn’t reach', () => {
    const { state } = playDue(sim, stateOf(sim, series({ format: 'blind' })));
    const wrong = { ...state, winner: state.winner === 'a' ? ('b' as const) : ('a' as const) };
    expect(verifyFinished(sim, wrong).ok).toBe(false);
  });
});

describe('the frozen rulesets', () => {
  it('say clearly when a series names a ruleset the server has no bundle for', async () => {
    const missing = await rulesetSim(9999).catch((error: unknown) => error);
    expect(missing).toBeInstanceOf(ApiError);
    expect((missing as ApiError).code).toBe('ruleset_missing');
  });
});

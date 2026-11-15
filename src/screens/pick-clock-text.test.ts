import { describe, expect, it } from 'vitest';
import type { LiveView } from '../api/live.ts';
import type { SeriesView } from '../api/series.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { startSeries, type Format, type SeriesState } from '../sim/series.ts';
import { pickClockOf, URGENT_SECONDS } from './pick-clock-text.ts';

const T = 1_700_000_000_000;
const clock = (over: Partial<LiveView> = {}): LiveView => ({
  startedAt: T - 10_000,
  startBy: T + 50_000,
  opensAt: T - 4_000,
  fights: [],
  auto: [],
  away: null,
  endReason: null,
  ...over,
});
const view = (over: Partial<SeriesView> = {}, live: Partial<LiveView> = {}) =>
  ({
    you: 'a',
    names: { a: 'Player 1', b: 'Player 4821' },
    turn: 'a',
    deadline: new Date(T + 22_000).toISOString(),
    status: 'open',
    winner: null,
    rounds: [],
    live: clock(live),
    ...over,
  }) as unknown as SeriesView;

const series = (format: Format): SeriesState =>
  startSeries({
    ruleset: RULESET_VERSION,
    opponent: { kind: 'player' } as never,
    seed: 1,
    a: ['storm', 'frost', 'quake'],
    b: ['archer', 'brawler', 'vampire'],
    format,
  });
const lookup = BALL_LOOKUP;

describe('the pick card (ADR 0055, B2)', () => {
  it('counts the player’s own pick down, the bar its share of the 30 s', () => {
    const card = pickClockOf(view(), series('reveal'), T, lookup);
    expect(card).toMatchObject({ kind: 'yours', title: 'Your pick', seconds: 22, urgent: false });
    expect(card?.left).toBeCloseTo(22 / 30);
  });

  it('turns urgent at 10 s and not before', () => {
    const at = (left: number) =>
      pickClockOf(
        view({ deadline: new Date(T + left).toISOString() }),
        series('reveal'),
        T,
        lookup,
      );
    expect(at(10_500)?.urgent).toBe(false);
    expect(at(URGENT_SECONDS * 1000)?.urgent).toBe(true);
    expect(at(7_000)).toMatchObject({ seconds: 7, urgent: true });
  });

  it('shows the other player picking, with what they answer and what comes next', () => {
    // The player showed Storm; Player 4821 answers from their three.
    const shown = { ...series('reveal'), picks: [{ round: 0, side: 'a' as const, ball: 'storm' }] };
    const card = pickClockOf(view({ turn: 'b' }), shown, T, lookup);
    expect(card).toMatchObject({
      kind: 'theirs',
      title: 'Player 4821 is picking',
      seconds: 22,
      answering: {
        line: 'You showed Storm. They answer from:',
        from: ['archer', 'brawler', 'vampire'],
      },
      next: 'You’ll fight as soon as they pick.',
    });
  });

  it('says they show first when they do', () => {
    const card = pickClockOf(view({ turn: 'b' }), series('reveal'), T, lookup);
    expect(card?.answering?.line).toBe('They show first, from:');
    expect(card?.next).toBe('Then you answer.');
  });

  it('waits for the friend to join with the 60 s as its bar, the stay rule elsewhere', () => {
    const card = pickClockOf(
      view({}, { startedAt: null, opensAt: null }),
      series('reveal'),
      T,
      lookup,
    );
    expect(card).toMatchObject({
      kind: 'join',
      title: 'Waiting for Player 4821 to join',
      seconds: 50,
    });
    expect(card?.left).toBeCloseTo(50 / 60);
  });

  it('counts an away player’s grace down', () => {
    const card = pickClockOf(
      view({}, { away: { since: T - 6_000, forfeitAt: T + 20_000 } }),
      series('reveal'),
      T,
      lookup,
    );
    expect(card).toMatchObject({ kind: 'away', title: 'Player 4821 disconnected', seconds: 20 });
  });

  it('shows nothing while a fight is still on, by turns, or at the end', () => {
    expect(
      pickClockOf(view({}, { opensAt: T + 5_000 }), series('reveal'), T, lookup),
    ).toBeUndefined();
    expect(
      pickClockOf(view({ status: 'done' } as never), series('reveal'), T, lookup),
    ).toBeUndefined();
    expect(pickClockOf(view({ live: null }), series('reveal'), T, lookup)).toBeUndefined();
  });
});

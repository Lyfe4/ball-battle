import { describe, expect, it } from 'vitest';
import type { RematchView } from '../api/rematch.ts';
import {
  rematchChoiceOf,
  rematchClockOf,
  rematchEnding,
  rematchBackOf,
  rematchNoticeOf,
  rematchOpen,
} from './rematch-text.ts';

const T = 1_700_000_000_000;
const rematch = (over: Partial<RematchView> = {}): RematchView => ({
  state: 'none',
  askedBy: null,
  declinedBy: null,
  deadline: null,
  now: T,
  lineupIn: false,
  seriesId: null,
  offered: true,
  startId: null,
  ...over,
});
const asked = (by: 'a' | 'b') => rematch({ state: 'asked', askedBy: by, deadline: T + 21_000 });

describe('a rematch on the end screen (ADR 0055)', () => {
  it('offers Rematch while one may be asked, and Rematch or No thanks to the one asked', () => {
    expect(rematchChoiceOf(rematch(), 'a')).toBe('offer');
    expect(rematchChoiceOf(rematch({ offered: false }), 'a')).toBeUndefined();
    expect(rematchChoiceOf(asked('b'), 'a')).toBe('answer');
    expect(rematchChoiceOf(asked('a'), 'a')).toBeUndefined();
  });

  it('counts the answer down on the pick card, from both sides', () => {
    expect(rematchClockOf(asked('b'), 'a', 'Player 4821', T)).toMatchObject({
      kind: 'rematch',
      title: 'Player 4821 wants a rematch',
      seconds: 21,
      total: 30,
      urgent: false,
    });
    expect(rematchClockOf(asked('a'), 'a', 'Player 4821', T)?.title).toBe(
      'Waiting for Player 4821 to answer',
    );
    expect(rematchClockOf(rematch(), 'a', 'Player 4821', T)).toBeUndefined();
  });

  it('counts the lineups down once both said yes', () => {
    const agreed = rematch({ state: 'agreed', askedBy: 'a', deadline: T + 50_000, lineupIn: true });
    expect(rematchClockOf(agreed, 'b', 'Player 1', T)).toMatchObject({
      title: 'Waiting for Player 1’s lineup',
      seconds: 50,
      total: 60,
    });
  });

  it('says plainly why there is no rematch, to both players', () => {
    const no = rematch({ state: 'declined', askedBy: 'a', declinedBy: 'b' });
    expect(rematchEnding(no, 'a', 'Player 4821')).toBe('Player 4821 said no to a rematch.');
    expect(rematchEnding(no, 'b', 'Player 1')).toBe('You said no to a rematch.');
    expect(rematchEnding(rematch({ state: 'expired' }), 'a', 'Player 4821')).toBe(
      'No rematch: time ran out.',
    );
    expect(rematchEnding(asked('a'), 'a', 'Player 4821')).toBeUndefined();
  });
});

describe('a rematch reaching a player away from the end screen (playtest 2026-11-19)', () => {
  it('asks the player asked, with who and the seconds left, until they run out', () => {
    expect(rematchNoticeOf(asked('b'), 'a', 'Player 4821', T)).toMatchObject({
      kind: 'asked',
      clock: { title: 'Player 4821 wants a rematch', seconds: 21 },
    });
    expect(rematchNoticeOf(asked('b'), 'a', 'Player 4821', T + 21_000)).toBeUndefined();
    // The one who asked waits: nothing to answer.
    expect(rematchNoticeOf(asked('a'), 'a', 'Player 4821', T)).toBeUndefined();
    expect(rematchNoticeOf(rematch(), 'a', 'Player 4821', T)).toBeUndefined();
  });

  it('tells both players once both said yes, with the seconds left for the lineups', () => {
    // 2026-11-23: the one who asked went home and never heard the friend's yes.
    const agreed = rematch({ state: 'agreed', askedBy: 'a', deadline: T + 60_000 });
    expect(rematchNoticeOf(agreed, 'a', 'Player 4821', T)).toMatchObject({
      kind: 'agreed',
      clock: { title: 'Player 4821 accepted', seconds: 60, total: 60 },
    });
    expect(rematchNoticeOf(agreed, 'b', 'Player 4821', T)).toMatchObject({
      kind: 'agreed',
      clock: { title: 'Rematch on: choose your lineup', seconds: 60 },
    });
    // Its lineup in: waiting for the other's, nothing to say; out of time, nothing either.
    expect(rematchNoticeOf({ ...agreed, lineupIn: true }, 'a', 'Them', T)).toBeUndefined();
    expect(rematchNoticeOf(agreed, 'a', 'Them', T + 60_000)).toBeUndefined();
  });

  it('takes a player whose lineup was in into the new match once it started', () => {
    const started = rematch({ state: 'started', askedBy: 'a', seriesId: 'new' });
    expect(rematchNoticeOf(started, 'b', 'Them', T)).toStrictEqual({
      kind: 'started',
      seriesId: 'new',
    });
  });

  it('tells the one who asked of a no or the time running out, and nobody else', () => {
    const no = rematch({ state: 'declined', askedBy: 'a', declinedBy: 'b' });
    expect(rematchNoticeOf(no, 'a', 'Player 4821', T)).toStrictEqual({
      kind: 'ended',
      line: 'Player 4821 said no to a rematch.',
    });
    expect(rematchNoticeOf(no, 'b', 'Player 4821', T)).toBeUndefined();
    const late = rematch({ state: 'expired', askedBy: 'a', deadline: T - 1 });
    expect(rematchNoticeOf(late, 'a', 'Player 4821', T)).toStrictEqual({
      kind: 'ended',
      line: 'No rematch: time ran out.',
    });
    expect(rematchNoticeOf(late, 'b', 'Player 4821', T)).toBeUndefined();
    // Unless they said yes: then both are told the time ran out.
    expect(rematchNoticeOf(late, 'b', 'Player 4821', T, true)).toStrictEqual({
      kind: 'ended',
      line: 'No rematch: time ran out.',
    });
    // Taking back one's own ask says nothing.
    const takenBack = rematch({ state: 'declined', askedBy: 'a', declinedBy: 'a' });
    expect(rematchNoticeOf(takenBack, 'a', 'Player 4821', T)).toBeUndefined();
  });

  it('is open while it can still move', () => {
    expect(rematchOpen(rematch())).toBe(true);
    expect(rematchOpen(rematch({ offered: false }))).toBe(false);
    expect(rematchOpen(asked('a'))).toBe(true);
    expect(rematchOpen(rematch({ state: 'agreed' }))).toBe(true);
    // Its lineup in, the new match is still to start: the player who went home is moved into it.
    expect(rematchOpen(rematch({ state: 'agreed', lineupIn: true }))).toBe(true);
    for (const state of ['started', 'declined', 'expired'] as const) {
      expect(rematchOpen(rematch({ state }))).toBe(false);
    }
  });

  it('gives home a way back while it waits on this player, and only then', () => {
    expect(rematchBackOf(asked('a'), 'a', T)).toBe('answer');
    expect(rematchBackOf(asked('a'), 'b', T), 'the one asked has the card').toBeUndefined();
    const agreed = rematch({ state: 'agreed', askedBy: 'a', deadline: T + 60_000 });
    for (const you of ['a', 'b'] as const) expect(rematchBackOf(agreed, you, T)).toBe('lineup');
    expect(rematchBackOf({ ...agreed, lineupIn: true }, 'a', T)).toBeUndefined();
    expect(rematchBackOf(agreed, 'a', T + 60_000), 'out of time').toBeUndefined();
    expect(rematchBackOf(rematch(), 'a', T)).toBeUndefined();
  });
});

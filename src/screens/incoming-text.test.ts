// The incoming banner's words (ADR 0086).
import { describe, expect, it } from 'vitest';
import type { Invite } from '../api/friends.ts';
import {
  challengeIncoming,
  LATER_NAME,
  rematchIncoming,
  stoppedIncoming,
} from './incoming-text.ts';

const invite: Invite = { token: 't', from: 'Alex', format: 'reveal', bestOf: 3, live: true };
const clock = (title: string) =>
  ({ kind: 'rematch', title, seconds: 21, left: 0.7, total: 30, urgent: false }) as const;

describe('the incoming banner’s words', () => {
  it('says who challenges, the rules, and that the × keeps it in Friends', () => {
    expect(challengeIncoming(invite, 0.5)).toStrictEqual({
      who: 'Alex',
      title: 'Alex challenges you',
      line: 'Best of 3 · Reveal · live',
      answers: 'answer',
      later: LATER_NAME,
      left: 0.5,
    });
    expect(LATER_NAME).toBe('Later: keep it in Friends');
  });

  it('says the sender stopped waiting, with the way back', () => {
    expect(stoppedIncoming('Alex')).toStrictEqual({
      who: 'Alex',
      title: 'Alex stopped waiting',
      line: 'Challenge them back from Friends',
      answers: 'ok',
    });
  });

  it('says a rematch asked, agreed and ended, its bar the server’s clock', () => {
    const rules = 'Best of 3 · Reveal';
    expect(
      rematchIncoming({ kind: 'asked', clock: clock('Alex wants a rematch') }, 'Alex', rules),
    ).toStrictEqual({
      who: 'Alex',
      title: 'Alex wants a rematch',
      line: 'Best of 3 · Reveal · 21 s',
      answers: 'answer',
      left: 0.7,
    });
    expect(
      rematchIncoming({ kind: 'agreed', clock: clock('Alex accepted') }, 'Alex', rules),
    ).toMatchObject({ title: 'Alex accepted', answers: 'lineup', left: 0.7 });
    expect(
      rematchIncoming({ kind: 'ended', line: 'No rematch: time ran out.' }, 'Alex', rules),
    ).toStrictEqual({
      who: 'Alex',
      title: 'No rematch: time ran out.',
      line: rules,
      answers: 'ok',
    });
    expect(rematchIncoming({ kind: 'started', seriesId: 's' }, 'Alex', rules)).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import type { ChallengeInfo } from '../api/challenges.ts';
import { cardFor, challengeChips, howItGoes, type CardActions } from './online-challenge-text.ts';

const actions: CardActions = {
  token: 'abc',
  url: 'https://ballbattle.test/?challenge=abc',
  canShare: true,
  copy: () => Promise.resolve('Copied'),
  home: () => undefined,
  lineup: () => undefined,
  series: () => undefined,
  sendOwn: () => undefined,
  share: () => Promise.resolve('Shared'),
  cancel: () => Promise.resolve(),
};
const info = (over: Partial<ChallengeInfo> = {}): ChallengeInfo => ({
  format: 'reveal',
  bestOf: 3,
  from: 'Player 6908',
  status: 'open',
  seriesId: null,
  live: true,
  own: false,
  ...over,
});

describe('a live challenge’s card and lobby (ADR 0055)', () => {
  it('shows the friend who challenges them as a sticker, the facts as chips, how it goes', () => {
    const card = cardFor(info(), actions);
    expect(card.sticker).toStrictEqual({ above: 'A challenge from', title: 'Player 6908' });
    expect(card.chips).toStrictEqual(['Best of 3', 'Reveal', 'Live · 30 s a pick']);
    expect(card.steps?.title).toBe('How it goes');
    expect(card.steps?.items).toHaveLength(3);
    expect(card.buttons.map((button) => button.text)).toStrictEqual(['Build your lineup']);
    expect(card.quiet?.text).toBe('Not now');
    // The title stays for screen readers.
    expect(card.title).toBe('Player 6908 challenges you');
  });

  it('says how each format goes, and the stay rule last', () => {
    expect(howItGoes({ format: 'reveal', bestOf: 5 })).toStrictEqual([
      'Build your lineup of 5 without seeing theirs.',
      'Take turns showing a ball; the other answers.',
      'Stay until the end: leaving for 30 s loses the match.',
    ]);
    expect(howItGoes({ format: 'showdown', bestOf: 3 })[1]).toBe(
      'Open together; then the winner shows and the loser answers.',
    );
    expect(challengeChips({ format: 'showdown', bestOf: 5 })).toStrictEqual([
      'Best of 5',
      'Showdown',
      'Live · 30 s a pick',
    ]);
  });

  it('gives the lobby one main button, the link in a quiet box and Cancel as a quiet link', () => {
    const lobby = cardFor(info({ status: 'yours', own: true }), actions);
    expect(lobby.title).toBe('Your challenge');
    expect(lobby.waiting).toStrictEqual({
      title: 'Waiting for your friend',
      line: 'Best of 3 · Reveal · live',
    });
    expect(lobby.buttons.map((button) => button.text)).toStrictEqual(['Share link']);
    expect(lobby.link?.url).toBe('https://ballbattle.test/?challenge=abc');
    expect(lobby.link?.copy).toBeDefined();
    expect(lobby.note).toBe(
      'The match starts the moment they accept. Stay until the end: leaving for 30 s loses the match.',
    );
    expect(lobby.quiet?.text).toBe('Cancel challenge');
  });

  it('makes Copy link the main button where there is no share sheet, with no second Copy', () => {
    const lobby = cardFor(info({ status: 'yours', own: true }), { ...actions, canShare: false });
    expect(lobby.buttons.map((button) => button.text)).toStrictEqual(['Copy link']);
    expect(lobby.link?.copy).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import type { ChallengeInfo } from '../api/challenges.ts';
import { cardFor, challengeChips, howItGoes, type CardActions } from './online-challenge-text.ts';
import { inAMatchCard, lobbyWaitingCard } from './current-match.ts';

const actions: CardActions = {
  token: 'abc',
  url: 'https://ballbattle.test/?challenge=abc',
  canShare: true,
  copy: () => Promise.resolve('Copied'),
  home: () => undefined,
  accept: () => Promise.resolve(),
  lineups: () => Promise.resolve(),
  series: () => undefined,
  sendOwn: () => undefined,
  share: () => Promise.resolve('Shared'),
  cancel: () => Promise.resolve(),
  unblock: () => Promise.resolve(),
};
const info = (over: Partial<ChallengeInfo> = {}): ChallengeInfo => ({
  format: 'reveal',
  bestOf: 3,
  from: 'Player 6908',
  status: 'open',
  seriesId: null,
  startId: null,
  live: true,
  own: false,
  invitee: null,
  declined: false,
  blocked: null,
  ...over,
});

describe('a live challenge’s card and lobby (ADR 0055)', () => {
  it('shows the friend who challenges them as a sticker, the facts as chips, how it goes', () => {
    const card = cardFor(info(), actions);
    expect(card.sticker).toStrictEqual({ above: 'A challenge from', title: 'Player 6908' });
    expect(card.chips).toStrictEqual(['Best of 3', 'Reveal', 'Live · 30 s a pick']);
    expect(card.steps?.title).toBe('How it goes');
    expect(card.steps?.items).toHaveLength(3);
    expect(card.buttons.map((button) => button.text)).toStrictEqual(['Accept']);
    expect(card.quiet?.text).toBe('Not now');
    // The title stays for screen readers.
    expect(card.title).toBe('Player 6908 challenges you');
  });

  it('says how each format goes, and the stay rule last', () => {
    expect(howItGoes({ format: 'reveal', bestOf: 5 })).toStrictEqual([
      'Accept, then you both pick 5 at once, without seeing theirs.',
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
      'Once they accept, you both pick your lineups. Stay until the end: leaving for 30 s loses the match.',
    );
    expect(lobby.quiet?.text).toBe('Cancel challenge');
  });

  it('makes Copy link the main button where there is no share sheet, with no second Copy', () => {
    const lobby = cardFor(info({ status: 'yours', own: true }), { ...actions, canShare: false });
    expect(lobby.buttons.map((button) => button.text)).toStrictEqual(['Copy link']);
    expect(lobby.link?.copy).toBeUndefined();
  });
});

describe('a challenge by turns sent to a friend (ADR 0085)', () => {
  const sent = (over: Partial<ChallengeInfo> = {}) =>
    cardFor(info({ status: 'yours', own: true, live: false, invitee: 'Jo', ...over }), actions);

  it('says it reached them and how it goes, with Home; the link stays to share', () => {
    const card = sent();
    expect(card.title).toBe('Sent to Jo');
    expect(card.body).toStrictEqual([
      'Best of 3 · Reveal · take turns',
      'Jo has it in Friends. Once they accept, you take turns, up to a day each; “Your turn” shows on Play and Friends.',
    ]);
    expect(card.buttons.map((button) => button.text)).toStrictEqual(['Home', 'Share link']);
  });

  it('says when they said no thanks', () => {
    expect(sent({ declined: true }).title).toBe('Jo said no thanks');
  });

  it('keeps the link card for one sent to nobody in particular', () => {
    expect(sent({ invitee: null }).title).toBe('Send this link to a friend');
  });
});

describe('the challenge lifecycle’s words (ADR 0086)', () => {
  it('tells a player who blocked the sender, with Unblock and Not now', () => {
    const card = cardFor(info({ blocked: 'pair-1' }), actions);
    expect(card.title).toBe('You blocked Player 6908');
    expect(card.buttons.map((button) => button.text)).toStrictEqual(['Unblock']);
    expect(card.quiet?.text).toBe('Not now');
    // Nobody blocked: the challenge as ever.
    expect(cardFor(info(), actions).title).toBe('Player 6908 challenges you');
  });

  it('says whose lobby waits when sending or accepting another, never the server’s sentence', () => {
    const lobby = { kind: 'lobby', token: 't', format: 'reveal', bestOf: 3 } as const;
    const ways = {
      open: () => Promise.resolve(),
      replace: () => Promise.resolve(),
      home: () => undefined,
    };
    const send = lobbyWaitingCard({ ...lobby, invitee: 'Jo' }, 'send', ways);
    expect(send.title).toBe('You already challenged Jo');
    expect(send.buttons.map((button) => button.text)).toStrictEqual([
      'Open it',
      'Cancel that and send this',
    ]);
    const accept = lobbyWaitingCard({ ...lobby, invitee: null }, 'accept', ways);
    expect(accept.title).toBe('Your challenge link is waiting');
    expect(accept.buttons[1]?.text).toBe('Cancel that and accept this');
    expect(
      inAMatchCard(
        () => Promise.resolve(),
        () => undefined,
      ).body,
    ).toStrictEqual(['One live match at a time.']);
  });
});

describe('the friend lobby (ADR 0086)', () => {
  const lobby = (over: Partial<ChallengeInfo> = {}) =>
    cardFor(info({ status: 'yours', own: true, invitee: 'Jo', ...over }), actions);

  it('says Challenge sent, waits for Jo by name, says what comes next, the link folded', () => {
    const card = lobby();
    expect(card.title).toBe('Challenge sent');
    expect(card.waiting).toStrictEqual({
      title: 'Waiting for Jo',
      line: 'Best of 3 · Reveal · live',
      who: 'Jo',
    });
    expect(card.note).toMatch(/^Once they accept, you both pick lineups, 60 s\./);
    expect(lobby({ bestOf: 5 }).note).toMatch(/pick lineups, 75 s\./);
    expect(card.buttons).toStrictEqual([]);
    expect(card.quiet?.text).toBe('Cancel challenge');
    expect([card.link?.fold, card.link?.share?.text]).toStrictEqual([
      'Also send a link',
      'Share link',
    ]);
  });

  it('after a No thanks leads with Challenge someone else and Home', () => {
    const card = lobby({ declined: true });
    expect(card.title).toBe('Jo said no thanks');
    expect(card.buttons.map((button) => button.text)).toStrictEqual([
      'Challenge someone else',
      'Home',
    ]);
    expect(card.link?.fold).toBe('Also send a link');
  });

  it('keeps Copy link first in a lobby for a link to anyone', () => {
    const card = lobby({ invitee: null });
    expect(card.title).toBe('Your challenge');
    expect(card.buttons[0]?.text).toBe('Share link');
    expect(card.link?.fold).toBeUndefined();
  });
});

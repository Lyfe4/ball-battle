// The Friends section's words (ADR 0079, PR (c)).
import { describe, expect, it } from 'vitest';
import type { InboxResponse } from '../api/friends.ts';
import {
  BLOCK_STEP,
  personStatus,
  REMOVE_STEP,
  addedLine,
  friendsTabLabel,
  hasAnyone,
  challengeUnavailable,
  STATUS_WORDS,
  endingLine,
  friendsTitle,
  gameName,
  inboxToWatch,
  waitingCount,
} from './friends-text.ts';

const EMPTY = { code: '7KQ2M9XD', friends: [], incoming: [], outgoing: [], blocked: [] };

describe('the Friends section’s words', () => {
  it('says a request was sent, or that you are friends now', () => {
    expect(addedLine({ ...EMPTY, outcome: 'requested', name: 'Sam_R' })).toBe(
      'Request sent to Sam_R.',
    );
    expect(addedLine({ ...EMPTY, outcome: 'friends', name: 'Sam_R' })).toBe(
      'You and Sam_R are friends now.',
    );
  });

  it('knows an empty list from one with a request in it', () => {
    expect(hasAnyone(EMPTY)).toBe(false);
    expect(hasAnyone({ ...EMPTY, outgoing: [{ id: 'x', name: 'Jo' }] })).toBe(true);
  });

  it('names a friend’s challenge and every status in words', () => {
    expect(Object.values(STATUS_WORDS)).toStrictEqual(['Online', 'In a match', 'Offline']);
  });
});

describe('what waits, on the strip and the badge (ADR 0081)', () => {
  const friend = (status: 'online' | 'in_a_match' | 'offline') => ({
    id: status,
    name: 'X',
    status,
  });
  const invite = {
    token: 't',
    from: 'Sam',
    format: 'reveal',
    bestOf: 3,
    live: true,
  } as unknown as InboxResponse['invites'][number];
  const turn = (opponent: string | null) => ({
    seriesId: opponent ?? 'gone',
    opponent,
    deadline: '2026-11-26T10:00:00.000Z',
  });

  it('counts what waits for the badge: turns, challenges and requests (ADR 0085)', () => {
    const none = { friends: [friend('online')], requests: 1, invites: [] };
    expect(waitingCount({ ...none, invites: [invite], turns: [turn('Sam')] })).toBe(3);
  });

  it('keeps watching an inbox with a game waiting on the other player, friends or not', () => {
    const empty = { friends: [], requests: 0, invites: [], turns: [] };
    expect(inboxToWatch(empty)).toBe(false);
    // A game from a link, or with a friend since removed: their move makes it "Your turn".
    expect(inboxToWatch({ ...empty, games: [turn('Sam')] })).toBe(true);
    expect(inboxToWatch({ ...empty, turns: [turn('Sam')] })).toBe(true);
    expect(inboxToWatch({ ...empty, friends: [friend('offline')] })).toBe(true);
    expect(inboxToWatch({ ...empty, requests: 1 })).toBe(true);
    expect(inboxToWatch({ ...empty, invites: [invite] })).toBe(true);
    // An ending only waits to be seen: nothing more will come of it.
    expect(
      inboxToWatch({ ...empty, endings: [{ seriesId: 's', opponent: 'Sam', outcome: 'won' }] }),
    ).toBe(false);
  });

  it('says who is online in the friends list’s title, never "0 online" (ADR 0086)', () => {
    expect(friendsTitle('Friends', [])).toBe('Friends · 0');
    expect(friendsTitle('Friends', [friend('online'), friend('offline')])).toBe(
      'Friends · 2 · 1 online',
    );
    expect(friendsTitle('Friends', [friend('in_a_match'), friend('offline')])).toBe('Friends · 2');
  });

  it('counts what waits on the player for the badge, and names it', () => {
    expect(
      waitingCount({ friends: [friend('online')], requests: 1, invites: [invite], turns: [] }),
    ).toBe(2);
    expect(waitingCount({ friends: [], requests: 0, invites: [], turns: [] })).toBe(0);
    expect(friendsTabLabel(2)).toBe('Friends, 2 waiting');
    expect(friendsTabLabel(0)).toBe('Friends');
  });
});

describe('the person’s sheet’s words (ADR 0086)', () => {
  it('says a friend’s status, and “Waiting for you” for one waiting in their lobby', () => {
    expect(personStatus({ status: 'in_a_match' }, 'friend')).toBe('In a match');
    expect(personStatus({ status: 'in_a_match' }, 'friend', true)).toBe('Waiting for you');
    expect(personStatus({}, 'friend')).toBe('Offline');
    expect(personStatus({}, 'incoming')).toBe('Wants to be friends');
    expect(personStatus({}, 'outgoing')).toBe('Request sent');
  });

  it('says why Challenge can’t be taken, by turns working any time where it is built', () => {
    const jo = (status: 'online' | 'offline' | 'in_a_match') => ({ name: 'Jo', status });
    expect(challengeUnavailable(jo('online'), false, false)).toBeUndefined();
    // By turns works any time: "Who do you want to play?" says which (ADR 0089 addendum).
    expect(challengeUnavailable(jo('offline'), false, true)).toBeUndefined();
    expect(challengeUnavailable(jo('in_a_match'), false, true)).toBeUndefined();
    // Where the build doesn't play by turns: wait for them.
    expect(challengeUnavailable(jo('offline'), false, false)).toBe(
      'Jo is offline · Try again when they’re online',
    );
    expect(challengeUnavailable(jo('in_a_match'), false, false)).toBe(
      'Jo is in a match · Try again after it',
    );
    // Their lobby waits for you: accept theirs, whatever their status.
    expect(challengeUnavailable(jo('in_a_match'), true, true)).toBe(
      'Jo is waiting for you · Accept in Waiting for you',
    );
  });

  it('confirms Remove and Block with what they do, never what the other is told', () => {
    expect(REMOVE_STEP('Jo')).toStrictEqual({
      title: 'Remove Jo?',
      text: 'You stop being friends. Jo isn’t told, and you can add them again later.',
      action: 'Remove Jo',
    });
    expect(BLOCK_STEP('Jo').title).toBe('Block Jo?');
    expect(BLOCK_STEP('Jo').text).toContain('can’t add or challenge you');
    expect(BLOCK_STEP('Jo').action).toBe('Block Jo');
  });
});

describe('Your games’ words (ADR 0086)', () => {
  it('says whose turn, and how a game ended, to each player', () => {
    expect(gameName({ opponent: 'Sam' })).toBe('Sam’s turn');
    expect(gameName({ opponent: null })).toBe('Their turn');
    expect(endingLine({ opponent: 'Sam', outcome: 'won-ran-out' })).toBe(
      'You won vs Sam: their turn ran out',
    );
    expect(endingLine({ opponent: 'Sam', outcome: 'lost' })).toBe('Sam won');
    expect(endingLine({ opponent: 'Sam', outcome: 'lost-ran-out' })).toBe(
      'You lost: your turn ran out',
    );
    expect(endingLine({ opponent: 'Sam', outcome: 'won' })).toBe('You won vs Sam');
  });
});

// The Friends section's words (ADR 0079, PR (c)).
import { describe, expect, it } from 'vitest';
import type { InboxResponse } from '../api/friends.ts';
import {
  addedLine,
  friendsTabLabel,
  hasAnyone,
  inviteLine,
  STATUS_WORDS,
  statusLine,
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
    expect(inviteLine({ token: 't', from: 'Sam_R', format: 'showdown', bestOf: 5 })).toBe(
      'Sam_R challenges you · Best of 5 · Showdown · live',
    );
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
  } as unknown as InboxResponse['invites'][number];

  it('puts what waits first, then who is online, and says nothing when there is nothing', () => {
    // One thing says it whole; more than one, each in a word, so a 390 px phone shows them all.
    expect(statusLine({ friends: [], requests: 0, invites: [invite] })).toBe('1 challenge waiting');
    expect(statusLine({ friends: [], requests: 2, invites: [] })).toBe('2 friend requests');
    expect(statusLine({ friends: [friend('online')], requests: 0, invites: [] })).toBe(
      '1 friend online',
    );
    expect(
      statusLine({ friends: [friend('online'), friend('online')], requests: 0, invites: [invite] }),
    ).toBe('1 challenge · 2 online');
    expect(statusLine({ friends: [friend('online')], requests: 2, invites: [] })).toBe(
      '2 requests · 1 online',
    );
    expect(
      statusLine({ friends: [friend('online'), friend('online')], requests: 1, invites: [invite] }),
    ).toBe('1 challenge · 1 request · 2 online');
    // Never "0 friends online": in a match or offline is not online.
    expect(
      statusLine({ friends: [friend('in_a_match'), friend('offline')], requests: 0, invites: [] }),
    ).toBeUndefined();
  });

  it('counts what waits on the player for the badge, and names it', () => {
    expect(waitingCount({ friends: [friend('online')], requests: 1, invites: [invite] })).toBe(2);
    expect(waitingCount({ friends: [], requests: 0, invites: [] })).toBe(0);
    expect(friendsTabLabel(2)).toBe('Friends, 2 waiting');
    expect(friendsTabLabel(0)).toBe('Friends');
  });
});

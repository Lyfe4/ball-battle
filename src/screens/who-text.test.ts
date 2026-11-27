import { describe, expect, it } from 'vitest';
import type { FriendEntry } from '../api/friends.ts';
import {
  friendLine,
  howFor,
  othersTitle,
  rulesLine,
  sendSpoken,
  sendWords,
  showAll,
  whoOrder,
} from './who-text.ts';

const LIVE = { format: 'reveal', bestOf: 3, turns: false } as const;
const TURNS = { ...LIVE, turns: true } as const;
const friend = (id: string, status: FriendEntry['status']): FriendEntry => ({
  id,
  name: id,
  ...(status === undefined ? {} : { status }),
});

describe('the words of "Who do you want to play?" (ADR 0089 addendum of 2026-11-27)', () => {
  it('says the rules it sends on, from Play’s box', () => {
    expect(rulesLine(LIVE)).toBe('Live · Best of 3 · Reveal');
    expect(rulesLine({ format: 'showdown', bestOf: 5, turns: true })).toBe(
      'By turns · Best of 5 · Showdown',
    );
  });

  it('plays a friend live only while online, else by turns where the build has it', () => {
    expect(howFor(friend('a', 'online'), LIVE, false)).toBe('live');
    expect(howFor(friend('a', 'offline'), LIVE, false)).toBeUndefined();
    expect(howFor(friend('a', 'in_a_match'), LIVE, false)).toBeUndefined();
    expect(howFor(friend('a', 'offline'), LIVE, true)).toBe('turns');
    // By turns asked for: by turns, whoever is online.
    expect(howFor(friend('a', 'online'), TURNS, true)).toBe('turns');
    // Their lobby waits for you (they read as in a match): live, accepting theirs (crossed).
    expect(howFor(friend('a', 'in_a_match'), TURNS, true, true)).toBe('live');
    expect(friendLine(friend('a', 'in_a_match'), 'live', LIVE, true)).toBe(
      'Waiting for you · live',
    );
  });

  it('says on each friend what picking them starts, or why they can’t be picked', () => {
    expect(friendLine(friend('a', 'online'), 'live', LIVE)).toBe('Online · live');
    expect(friendLine(friend('a', 'offline'), 'turns', LIVE)).toBe('Not online · by turns instead');
    expect(friendLine(friend('a', 'offline'), 'turns', TURNS)).toBe('Not online · by turns');
    expect(friendLine(friend('a', 'offline'), undefined, LIVE)).toBe('Not online');
    expect(friendLine(friend('a', 'in_a_match'), undefined, LIVE)).toBe(
      'In a match · try again after it',
    );
  });

  it('names the one button by what is picked, and nothing sends with nothing picked', () => {
    const robin = friend('Robin', 'online');
    expect(sendWords(undefined)).toBe('Choose who to play');
    expect(sendWords({ kind: 'link' })).toBe('Send a link');
    expect(sendWords({ kind: 'friend', friend: robin, how: 'live' })).toBe('Challenge Robin');
    expect(sendWords({ kind: 'friend', friend: robin, how: 'turns' })).toBe('Play Robin by turns');
    // Their challenge waits for you: the button says it accepts it.
    expect(sendWords({ kind: 'friend', friend: robin, how: 'live', accepts: true })).toBe(
      'Accept Robin’s challenge',
    );
    expect(sendSpoken({ kind: 'friend', friend: robin, how: 'live' }, LIVE)).toBe(
      'Challenge Robin live, Best of 3 · Reveal',
    );
    expect(sendSpoken(undefined, LIVE)).toBe('Choose who to play: pick a friend or a link first');
  });

  it('lists the online first, the friend last picked first in each group', () => {
    const list = [friend('a', 'offline'), friend('b', 'online'), friend('c', 'offline')];
    const { online, others } = whoOrder(list, 'c');
    expect(online.map((one) => one.id)).toStrictEqual(['b']);
    expect(others.map((one) => one.id)).toStrictEqual(['c', 'a']);
    expect([othersTitle(true, 3), othersTitle(false, 3)]).toStrictEqual([
      'Not online',
      'Friends · 3',
    ]);
    expect(showAll(18)).toBe('Show all 18 friends');
  });
});

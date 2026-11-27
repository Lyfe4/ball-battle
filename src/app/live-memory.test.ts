import { afterEach, describe, expect, it } from 'vitest';
import { knownLive, rememberLive } from './live-memory.ts';
import { visitCache } from './visit-cache.ts';

const start = { kind: 'start', id: 's', format: 'reveal', bestOf: 3 } as const;
const lobby = {
  kind: 'lobby',
  token: 't',
  format: 'reveal',
  bestOf: 3,
  invitee: null,
  stopsInMs: 60_000,
} as const;

afterEach(() => {
  visitCache.clear();
});

describe('what the page knows of the live match', () => {
  it('is nothing learnt until a screen or the server says', () => {
    expect(knownLive()).toBeUndefined();
    rememberLive(null);
    expect(knownLive()).toBeNull();
    rememberLive(start);
    expect(knownLive()).toStrictEqual(start);
  });

  it('keeps a lobby only until it would stop unheard, so a failing ask never shows a stale one', () => {
    rememberLive(lobby, 1_000);
    expect(knownLive(60_999)).toStrictEqual(lobby);
    expect(knownLive(61_000)).toBeUndefined();
  });

  it('forgets everything when who the player is changes', () => {
    rememberLive(start);
    visitCache.clear();
    expect(knownLive()).toBeUndefined();
  });
});

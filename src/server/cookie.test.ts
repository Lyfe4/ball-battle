import { describe, expect, it } from 'vitest';
import { hasPlayerHint } from '../api/session.ts';
import {
  clearedPlayerHintCookie,
  clearedSessionCookie,
  cookieValue,
  playerHintCookie,
  readSession,
  sessionCookie,
  withPlayerHint,
} from './cookie.ts';

const requestWith = (cookie: string) =>
  new Request('https://x.test/', { headers: { Cookie: cookie } });

describe('the session cookie', () => {
  it('round-trips the tokens among other cookies', () => {
    const set = sessionCookie({ access: 'a.b.c', refresh: 'r1' });
    const pair = set.split(';')[0] ?? '';
    expect(readSession(requestWith(`other=1; ${pair}; more=2`))).toStrictEqual({
      access: 'a.b.c',
      refresh: 'r1',
    });
  });

  it('reads nothing from a missing, malformed or tampered cookie', () => {
    for (const cookie of [
      '',
      '__Host-bb_session=',
      '__Host-bb_session=not-base64-json',
      `__Host-bb_session=${Buffer.from('{"a":1,"r":"x"}').toString('base64url')}`,
      `__Host-bb_session=${Buffer.from('{"a":"<script>","r":"x"}').toString('base64url')}`,
      'bb_session=abc',
    ]) {
      expect(readSession(requestWith(cookie)), cookie).toBeUndefined();
    }
  });

  it('is cleared with the same attributes and no lifetime', () => {
    expect(clearedSessionCookie()).toBe(
      '__Host-bb_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    );
    expect(cookieValue('a=1; b=2', 'b')).toBe('2');
  });
});

describe('the player hint (ADR 0079 addendum of 2026-11-22)', () => {
  const session = sessionCookie({ access: 'a.b.c', refresh: 'r1' });

  it('is readable by the page and holds nothing but that a player is here', () => {
    expect(playerHintCookie()).toBe(
      '__Host-bb_player=1; Path=/; Secure; SameSite=Lax; Max-Age=34560000',
    );
    expect(playerHintCookie()).not.toContain('HttpOnly');
  });

  it('follows the session: set with it, cleared with it, untouched without it', () => {
    expect(withPlayerHint(['a=1', session])).toStrictEqual(['a=1', session, playerHintCookie()]);
    expect(withPlayerHint([clearedSessionCookie()])).toStrictEqual([
      clearedSessionCookie(),
      clearedPlayerHintCookie(),
    ]);
    // A refresh, then the session ended in the same answer: the last word wins.
    expect(withPlayerHint([session, clearedSessionCookie()]).at(-1)).toBe(
      clearedPlayerHintCookie(),
    );
    // A `/me` read sets the hint alone; a sign-in step's cookie leaves it as it is.
    expect(withPlayerHint([playerHintCookie()])).toStrictEqual([playerHintCookie()]);
    expect(withPlayerHint(['__Host-bb_email=x; Path=/'])).toStrictEqual([
      '__Host-bb_email=x; Path=/',
    ]);
  });
});

describe('the page reads the hint the server sets', () => {
  it('finds it among other cookies, and not once cleared', () => {
    const pair = playerHintCookie().split(';')[0] ?? '';
    expect(hasPlayerHint(`a=1; ${pair}; b=2`)).toBe(true);
    expect(hasPlayerHint(clearedPlayerHintCookie().split(';')[0] ?? '')).toBe(false);
    expect(hasPlayerHint('')).toBe(false);
    expect(hasPlayerHint('bb_player=1')).toBe(false);
  });
});

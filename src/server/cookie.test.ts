import { describe, expect, it } from 'vitest';
import { clearedSessionCookie, cookieValue, readSession, sessionCookie } from './cookie.ts';

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

// The privacy policy and terms (ADR 0069) say what the code does: the facts they state are read
// back from the constants that decide them, so a change to either fails here until both agree.
// They are pages of their own, built with the game, each with a way back (ADR 0027: no dead ends).
import { readFileSync } from 'node:fs';
import { RECENT_SERIES } from '../src/api/record.ts';
import { describe, expect, it } from 'vitest';
import { GRACE_MS, START_WINDOW_MS } from '../src/api/live.ts';
import { LEGAL_LINKS, adultCard } from '../src/screens/online-challenge-text.ts';
import { INACTIVE_ACCOUNT_DAYS, INACTIVE_DAYS } from '../src/server/inactive.ts';
import { SIGN_IN_SECONDS } from '../src/server/sealed-cookie.ts';
import { REPORT_DAYS } from '../src/server/blocks.ts';
import { DECLINE_DAYS } from '../src/server/db/friends.ts';
import { ENDING_DAYS, ONLINE_MS } from '../src/server/db/inbox.ts';
import { USERNAME_DAYS } from '../src/server/db/profiles.ts';
import { LIMITS } from '../src/server/rate-limit.ts';

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const privacy = read('privacy.html');
const terms = read('terms.html');
const pages = { 'privacy.html': privacy, 'terms.html': terms };

describe('the privacy policy and terms', () => {
  it.each(Object.entries(pages))('%s is finished, dated, and leads back to the game', (_, html) => {
    expect(html).not.toMatch(/\[check\]|\[date|Notes for Calvin/i);
    expect(html).toMatch(/Last updated \d{1,2} [A-Z][a-z]+ \d{4}/);
    expect(html).toContain('href="/"');
    expect(html).toContain('calvin@calvinrdevelopment.com');
    // No script: they read without the game, and under the same CSP.
    expect(html).not.toMatch(/<script|style="/);
  });

  it('link to each other', () => {
    expect(privacy).toContain('href="/terms.html"');
    expect(terms).toContain('href="/privacy.html"');
  });

  it('are built with the game', () => {
    const config = read('vite.config.ts');
    for (const file of Object.keys(pages)) expect(config).toContain(`'${file}'`);
  });

  it('are linked from the 16+ question, before the first online action', () => {
    const card = adultCard(
      () => Promise.resolve(),
      () => undefined,
    );
    expect(card.links?.map((link) => link.href)).toEqual(Object.keys(pages).map((f) => `/${f}`));
    expect(LEGAL_LINKS.map((link) => link.href)).toEqual(['/privacy.html', '/terms.html']);
    // The card says what is kept, the IP included, as the policy does.
    expect(card.body.join(' ')).toContain('IP address');
    expect(privacy).toContain('IP address, recorded with your guest');
  });

  it('give the retention the server keeps to', () => {
    expect(privacy).toContain(`until ${String(INACTIVE_DAYS)} days after you last played online`);
    expect(privacy).toContain(`A guest nobody has used for ${String(INACTIVE_DAYS)} days`);
  });

  it('give an account’s retention, and the sign-in steps’ (ADR 0079)', () => {
    expect(INACTIVE_ACCOUNT_DAYS).toBe(730);
    expect(privacy).toContain('until 24 months after you last played online');
    expect(privacy).toContain('An account nobody has used for 24 months is deleted');
    expect(SIGN_IN_SECONDS).toBe(600);
    expect(privacy).toContain('Up to 10 minutes, on your device.');
    expect(privacy).toContain('Each works for 10 minutes');
    const emailCounts = [
      LIMITS.codesToAddress,
      LIMITS.codesToAddressDaily,
      LIMITS.codesFromNetwork,
      LIMITS.codesFromNetworkDaily,
      LIMITS.triesAtCode,
      LIMITS.triesAtAddress,
      LIMITS.triesFromNetwork,
    ];
    expect(Math.max(...emailCounts.map((limit) => limit.windowSeconds))).toBeLessThanOrEqual(
      86_400,
    );
    expect(privacy).toContain('<strong>Resend</strong>');
  });

  it('name the username, its 30 days, Delete account and Log out (ADR 0079)', () => {
    expect(USERNAME_DAYS).toBe(30);
    expect(privacy).toContain('Your username, if you choose one, and when you chose it');
    expect(privacy).toContain(`once every ${String(USERNAME_DAYS)} days`);
    const counts = [LIMITS.usernames, LIMITS.usernamesFromNetwork];
    expect(Math.max(...counts.map((limit) => limit.windowSeconds))).toBeLessThanOrEqual(86_400);
    expect(privacy).toContain('how many usernames are tried');
    expect(privacy).toContain('<strong>Delete account</strong>');
    expect(privacy).toContain('<strong>Log out</strong>');
  });

  it('name the friend code, friendships, a decline’s 30 days and the counts (ADR 0079)', () => {
    expect(privacy).toContain('Your friend code');
    expect(privacy).toContain(
      'Your friends and friend requests, and when each was sent and answered',
    );
    expect(privacy.replace(/\s+/g, ' ')).toContain(
      `A request you decline is kept for ${String(DECLINE_DAYS)} days`,
    );
    const counts = [
      LIMITS.friendLookups,
      LIMITS.friendLookupsFromNetwork,
      LIMITS.friendRequests,
      LIMITS.friendChanges,
    ];
    expect(Math.max(...counts.map((limit) => limit.windowSeconds))).toBeLessThanOrEqual(86_400);
    expect(privacy.replace(/\s+/g, ' ')).toContain('how many friends are looked up and asked');
  });

  it('name the seen mark of a game by turns and how long an ending waits (ADR 0086)', () => {
    expect(privacy).toContain('When you saw how a game by turns ended');
    expect(privacy.replace(/\s+/g, ' ')).toContain(
      `stops showing after ${String(ENDING_DAYS)} days`,
    );
  });

  it('name when an account was last active, its 150 s, and who a challenge went to (ADR 0079, 0082)', () => {
    expect(ONLINE_MS).toBe(150_000);
    expect(privacy).toContain('When you were last active, as one time we overwrite');
    expect(privacy.replace(/\s+/g, ' ')).toContain(
      `in the last ${String(ONLINE_MS / 1000)} seconds`,
    );
    expect(privacy).toContain('Who a challenge was sent to, and whether they said no thanks');
  });

  it('name the update channel’s key and Realtime’s 3-day record of each signal (ADR 0082)', () => {
    const text = privacy.replace(/\s+/g, ' ');
    expect(text).toContain(
      'A random key for your update channel, and a record of each update signal',
    );
    expect(text).toContain('through Supabase Realtime');
    expect(text).toContain('for about 3 days');
  });

  it('say the record is read from matches, seen by you, and by a friend only with them (ADR 0088)', () => {
    const text = privacy.replace(/\s+/g, ' ');
    expect(text).toContain('your record is worked out from these matches, never stored on its own');
    expect(text).toContain(`last ${String(RECENT_SERIES)} matches, which only you see`);
    expect(text).toContain('A friend sees only your record with them');
  });

  it('say a guest’s request counts go within about an hour (swept every 15 minutes)', () => {
    const perGuest = [LIMITS.challenges, LIMITS.moves, LIMITS.reads];
    expect(Math.max(...perGuest.map((limit) => limit.windowSeconds))).toBeLessThanOrEqual(3600);
    expect(privacy).toContain('Deleted within about an hour.');
  });

  it('give the live match timings the server uses', () => {
    expect(START_WINDOW_MS).toBe(60_000);
    expect(terms).toContain('within a minute of its start');
    expect(GRACE_MS).toBe(30_000);
    expect(terms).toContain('about half a minute');
  });

  it('names blocks and reported names, and how long a report is kept (ADR 0079, 2026-11-25)', () => {
    expect(privacy).toContain('<dt>Who you blocked</dt>');
    expect(privacy).toContain('Until you unblock them');
    expect(privacy).toContain('<dt>A username you report, why, and when</dt>');
    expect(REPORT_DAYS).toBe(90);
    expect(privacy).toContain(`${String(REPORT_DAYS)} days, then deleted`);
    expect(privacy).toContain('how many names are reported');
  });
});

// The privacy policy and terms (ADR 0069) say what the code does: the facts they state are read
// back from the constants that decide them, so a change to either fails here until both agree.
// They are pages of their own, built with the game, each with a way back (ADR 0027: no dead ends).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GRACE_MS, START_WINDOW_MS } from '../api/live.ts';
import { LEGAL_LINKS, adultCard } from '../screens/online-challenge-text.ts';
import { INACTIVE_DAYS } from '../server/inactive.ts';

const read = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
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

  it('give the live match timings the server uses', () => {
    expect(START_WINDOW_MS).toBe(60_000);
    expect(terms).toContain('within a minute of its start');
    expect(GRACE_MS).toBe(30_000);
    expect(terms).toContain('about half a minute');
  });
});

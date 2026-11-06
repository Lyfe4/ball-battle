// The real page in a real browser (`pnpm test:browsers`, at desktop size): tips in the arena
// (ADR 0036). A newcomer's match opens with the versus card, which a tap skips; the first time a
// ball's ability shows, a short label names it, once per device; a finished match offers "How it
// was won", closed. Turned off in the legend, none of it shows.
import { describe, expect, it } from 'vitest';
import page from '../../index.html?raw';
import { HINTS_SEEN_STORAGE_KEY, TIPS_STORAGE_KEY, VERSUS_SEEN_STORAGE_KEY } from '../app/tips.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { settle, visible } from './page-support.ts';

async function until(done: () => boolean, ms: number): Promise<void> {
  const end = Date.now() + ms;
  while (!done()) {
    if (Date.now() > end) throw new Error('Timed out waiting for the page');
    await settle();
  }
}

describe('tips in the arena', () => {
  it('shows the versus card, a hint the first time, and how the match was won', async () => {
    for (const key of [TIPS_STORAGE_KEY, HINTS_SEEN_STORAGE_KEY, VERSUS_SEEN_STORAGE_KEY]) {
      window.localStorage.removeItem(key);
    }
    window.localStorage.setItem('ballbattle.speed', '2');
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    const start = new URL(location.href);
    start.search = `?a=venom&b=thorns&seed=4&v=${String(RULESET_VERSION)}`;
    history.replaceState(null, '', start);
    await import('../main.ts');
    await settle();

    // The versus card names both balls and why one is favoured; a tap skips it.
    const versus = visible('.versus-card')[0];
    expect(versus?.textContent).toContain('Venom');
    expect(versus?.textContent).toContain('Thorns');
    expect(versus?.querySelector('.versus-mark')?.textContent).toBe('▲');
    versus?.click();
    await settle();
    expect(visible('.versus-card')).toHaveLength(0);

    // The first poisoning shows the Venom's hint, and the device remembers it.
    await until(() => visible('.ability-hint')[0]?.textContent === 'Poison!', 20_000);
    expect(window.localStorage.getItem(HINTS_SEEN_STORAGE_KEY)).toContain('venom');
    expect(window.localStorage.getItem(VERSUS_SEEN_STORAGE_KEY)).toBe('1');

    // At the end, "How it was won" is offered, closed, and tells the fight when opened.
    await until(() => visible('.hud .match-story').length === 1, 60_000);
    const story = visible('.hud .match-story')[0];
    expect(story?.hasAttribute('open')).toBe(false);
    story?.querySelector('summary')?.click();
    await settle();
    expect(story?.textContent).toContain('Poison');
    expect(story?.querySelector('.match-story-moments')?.textContent).toMatch(
      /knocked out|Time up/,
    );
    window.localStorage.removeItem('ballbattle.speed');
  }, 90_000);
});

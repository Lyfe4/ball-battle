// The real page in a real browser (`pnpm test:browsers`, at desktop size): teaching in the arena
// (ADR 0036, 0037). A Free play match of a pairing new to this device waits on its ready moment:
// both balls still where the match starts, the card saying who is favoured and what to watch, and
// Fight! to start. The first time a ball's ability shows, a short label names it, once per device;
// a finished match leads "How it was won" with its result. The same pairing again starts by
// itself, and with tips off no card shows.
import { describe, expect, it } from 'vitest';
import page from '../../index.html?raw';
import {
  HINTS_SEEN_STORAGE_KEY,
  READY_CARD_STORAGE_KEY,
  READY_SEEN_STORAGE_KEY,
  TIPS_STORAGE_KEY,
} from '../app/tips.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { button, settle, until, visible } from './page-support.ts';

const canvasNow = () => document.querySelector('canvas')?.toDataURL() ?? '';
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('tips in the arena', () => {
  it('holds a new pairing on its ready card, hints once, and tells how it was won', async () => {
    for (const key of [
      TIPS_STORAGE_KEY,
      HINTS_SEEN_STORAGE_KEY,
      READY_SEEN_STORAGE_KEY,
      READY_CARD_STORAGE_KEY,
    ]) {
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

    // The ready card names both balls, who is favoured and what to watch.
    const card = visible('.ready-card')[0];
    expect(card?.textContent).toContain('Venom');
    expect(card?.textContent).toContain('Thorns');
    expect(card?.querySelector('.ready-edge')?.textContent).toBe('▲ Venom is favoured');
    expect(card?.querySelector('.ready-reason')?.textContent).toMatch(/^What to watch: \S/);
    expect(window.localStorage.getItem(READY_SEEN_STORAGE_KEY)).toBe('thorns|venom');

    // Held: nothing moves, however long the player reads.
    await wait(900);
    const held = canvasNow();
    await wait(900);
    expect(canvasNow()).toBe(held);
    expect(visible('.ability-hint')).toHaveLength(0);

    button('Fight!').click();
    await settle();
    expect(visible('.ready-card')).toHaveLength(0);
    await wait(900);
    expect(canvasNow()).not.toBe(held);

    // The first poisoning shows the Venom's hint, and the device remembers it.
    await until(() => visible('.ability-hint')[0]?.textContent === 'Poison!', 20_000, false);
    expect(window.localStorage.getItem(HINTS_SEEN_STORAGE_KEY)).toContain('venom');

    // At the end, "How it was won" is offered, closed, its summary the result in one line.
    await until(() => visible('.hud .match-story').length === 1, 60_000, false);
    const story = visible('.hud .match-story')[0];
    expect(story?.hasAttribute('open')).toBe(false);
    expect(story?.querySelector('.match-story-result')?.textContent).toMatch(
      /^(Venom|Thorns) knocked out (Venom|Thorns) at \d:\d\d$|^Time up: /,
    );
    story?.querySelector('summary')?.click();
    await settle();
    expect(story?.textContent).toContain('Poison');
    const moments = [...(story?.querySelectorAll('.match-story-moments li') ?? [])];
    expect(moments.at(-1)?.getAttribute('data-kind')).toBe('finish');

    // The same pairing again: no card, and the match starts by itself.
    button('Change balls').click();
    await settle();
    button('Start match').click();
    await settle();
    expect(visible('.ready-card')).toHaveLength(0);
    const first = canvasNow();
    await wait(1600);
    expect(canvasNow()).not.toBe(first);

    // Tips off (the legend's switch): a new pairing shows no card either.
    button('Change balls').click();
    await settle();
    visible('.quick-setup .symbol-legend-toggle')[0]?.click();
    button('Turn tips off').click();
    visible('.ball-tile')
      .find((tile) => tile.dataset['ballId'] === 'storm')
      ?.click();
    button('Start match').click();
    await settle();
    expect(visible('.ready-card')).toHaveLength(0);
    expect(window.localStorage.getItem(READY_SEEN_STORAGE_KEY)).toBe('thorns|venom');
    window.localStorage.removeItem('ballbattle.speed');
    window.localStorage.removeItem(TIPS_STORAGE_KEY);
  }, 90_000);
});

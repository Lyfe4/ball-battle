// The real page in a real browser (`pnpm test:browsers`): the Winner sticker (ADR 0032) lands on the
// arena once a match is won, names the winner the HUD names, keeps its confetti capped, stays out
// of the accessibility tree, and goes when a new match starts.
import { describe, expect, it } from 'vitest';
import page from '../../index.html?raw';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { CONFETTI_PIECES } from '../ui/confetti.ts';
import { button, settle, until, visible } from './page-support.ts';

const card = () => visible('.winner-sticker-card')[0];

describe('the Winner sticker', () => {
  it('shows the winner once the match is won, and goes with a new match', async () => {
    window.localStorage.setItem('ballbattle.speed', '2');
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    const start = new URL(location.href);
    start.search = `?a=speedster&b=archer&seed=4&v=${String(RULESET_VERSION)}`;
    history.replaceState(null, '', start);
    await import('../main.ts');
    await settle();

    // Nothing while the match plays.
    expect(card()).toBeUndefined();

    await until(() => card() !== undefined, 60_000);
    // The HUD marks the winner once the result shows, a moment after the sticker lands.
    await until(() => visible('.hud-ball[data-outcome="won"]').length === 1, 5_000);
    const name = card()?.querySelector('.winner-sticker-name')?.textContent ?? '';
    expect(name).not.toBe('');
    const won = visible('.hud-ball[data-outcome="won"]')[0];
    expect(won?.querySelector('.hud-ball-name')?.textContent).toContain(name);
    expect(document.querySelector('.winner-sticker')?.getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelectorAll('.winner-confetti-piece')).toHaveLength(CONFETTI_PIECES);

    button('Replay').click();
    await settle();
    expect(card()).toBeUndefined();
  }, 90_000);
});

// The real page in a real browser (`pnpm test:browsers`, at desktop size): a Showdown against the Hard bot set up
// and started live (ADR 0035). The level is chosen on the rules step and remembered; round 1 asks
// for an opener marked against the bot's whole lineup, with a one-line key, and never names the
// bot's pick before it is made; picking starts the round with the chosen ball.
import { describe, expect, it } from 'vitest';
import page from '../../index.html?raw';
import { BOT_LEVEL_STORAGE_KEY } from '../app/bot-level.ts';
import { button, settle, visible } from './page-support.ts';

describe('a Showdown against the Hard bot', () => {
  it('remembers the level, asks for an opener and plays it', async () => {
    window.localStorage.removeItem(BOT_LEVEL_STORAGE_KEY);
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    const start = new URL(location.href);
    start.search = '?mode=bo3';
    history.replaceState(null, '', start);
    await import('../main.ts');
    await settle();

    // Blind has no choices for a level to change, so the level only shows for the others.
    expect(visible('.rules-level')).toHaveLength(0);
    visible('.rules-card')
      .find((card) => card.textContent.startsWith('Showdown'))
      ?.click();
    await settle();
    expect(visible('.rules-level')).toHaveLength(1);
    button('Hard bot').click();
    expect(window.localStorage.getItem(BOT_LEVEL_STORAGE_KEY)).toBe('hard');
    button('Choose lineup').click();
    await settle();

    for (const name of ['Storm', 'Berserker', 'Brawler']) {
      const tile = visible('.ball-tile').find(
        (node) => node.dataset['ballId'] === name.toLowerCase(),
      );
      tile?.click();
    }
    button('Reveal lineups').click();
    await settle();

    expect(visible('.answer-step .series-banner')[0]?.textContent).toBe(
      'Pick your opener. The bot picks at the same time.',
    );
    const rows = visible('.answer-step .pick-row');
    expect(rows).toHaveLength(3);
    // Every row is marked against each of the bot's three balls, and the key says what marks mean.
    for (const row of rows) expect(row.querySelectorAll('[data-symbol]')).toHaveLength(3);
    expect(visible('.answer-step .pick-key')[0]?.textContent).toContain('you’re favoured');
    expect(visible('.answer-step .symbol-legend-toggle')).toHaveLength(1);

    rows[1]?.querySelector<HTMLButtonElement>('.pick-row-pick')?.click();
    await settle();
    expect(location.search).toContain('fmt=showdown');
    const fighting = visible('.hud-ball-name').map((row) => row.textContent);
    expect(fighting[0]).toContain('Berserker');
    expect(visible('#series .series-bar-about')[0]?.textContent).toBe(
      'Best of 3 · Showdown · Hard',
    );
    window.localStorage.removeItem(BOT_LEVEL_STORAGE_KEY);
  }, 60_000);
});

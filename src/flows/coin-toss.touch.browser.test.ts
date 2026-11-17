// Reveal's coin toss on a phone (ADR 0061): a moment you can watch, not a blink. Round 1's pick
// waits while the coin flips for about two seconds and its result is held to be read; then the
// pick shows with the toss in words.
import { describe, expect, it } from 'vitest';
import { TOSS_FLIP_MS, TOSS_HOLD_MS } from '../api/live.ts';
import page from '../../index.html?raw';
import { button, settle, until, visible } from './page-support.ts';

const stageOf = () => visible('.answer-step .coin-toss')[0]?.dataset['stage'];

describe('the coin toss', () => {
  it('flips for about two seconds, holds who shows first, then opens the pick', async () => {
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    const start = new URL(location.href);
    start.search = '?mode=bo3&fmt=reveal&step=lineup&la=chrono,titan,storm';
    history.replaceState(null, '', start);
    await import('../main.ts');
    await settle();
    button('Reveal lineups').click();
    const opened = Date.now();
    await until(() => stageOf() === 'flipping', 1_000, 'the coin in the air');
    // Nothing of the pick shows while the coin is in the air: not even the bot's shown ball.
    expect(visible('.answer-step .pick-row')).toHaveLength(0);
    expect(visible('.answer-step .series-banner')).toHaveLength(0);
    expect(visible('.answer-step .series-track')).toHaveLength(0);
    expect(visible('.answer-step .coin-toss-words')[0]?.textContent).toBe('Coin toss…');

    await until(() => stageOf() === 'landed', TOSS_FLIP_MS + 1_000, 'the coin to land');
    const landed = Date.now();
    expect(landed - opened).toBeGreaterThanOrEqual(TOSS_FLIP_MS - 200);
    const said = visible('.answer-step .coin-toss-words')[0]?.textContent;
    expect(said).toMatch(/^(You show first|The bot shows first)$/);

    await until(() => stageOf() === undefined, TOSS_HOLD_MS + 1_000, 'the pick');
    expect(Date.now() - landed).toBeGreaterThanOrEqual(TOSS_HOLD_MS - 200);
    expect(visible('.answer-step .pick-row').length).toBeGreaterThan(0);
    expect(visible('.answer-step .series-banner')[0]?.textContent).toMatch(
      said === 'You show first' ? /^Coin toss: you show first\./ : /^Coin toss: the bot shows/,
    );
  });
});

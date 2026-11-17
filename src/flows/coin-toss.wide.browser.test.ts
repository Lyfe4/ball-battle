// Reveal's coin toss on a desktop (ADR 0061, 0031): the answer screen is two columns, and while the
// pick waits the toss sits across both, centred on the sheet, never in one column beside an empty
// one.
import { describe, expect, it } from 'vitest';
import page from '../../index.html?raw';
import { button, settle, until, visible } from './page-support.ts';

describe('the coin toss on a desktop', () => {
  it('is centred across the answer screen while the pick waits', async () => {
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    const start = new URL(location.href);
    start.search = '?mode=bo3&fmt=reveal&step=lineup&la=chrono,titan,storm';
    history.replaceState(null, '', start);
    await import('../main.ts');
    await settle();
    button('Reveal lineups').click();
    await until(() => visible('.answer-step .coin-toss').length === 1, 2_000, 'the coin toss');
    const sheet = visible('.answer-step')[0]?.getBoundingClientRect();
    const coin = visible('.answer-step .coin-toss-coin')[0]?.getBoundingClientRect();
    if (sheet === undefined || coin === undefined) throw new Error('No toss');
    expect(Math.abs(coin.left + coin.width / 2 - (sheet.left + sheet.width / 2))).toBeLessThan(2);
  });
});

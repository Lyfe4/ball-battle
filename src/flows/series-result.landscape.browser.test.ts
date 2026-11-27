// The result on a phone turned sideways (812 x 375, browsers-landscape): every way on (Rematch,
// Change balls and Home) shows without a scroll (2026-11-28 audit; the two columns of #257 left
// Home just under the fold). Plays a decided Reveal link to its result and never moves on.
import { describe, expect, it } from 'vitest';
import { page as browserPage } from 'vitest/browser';
import page from '../../index.html?raw';
import { writeSeriesParams } from '../app/series-url.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { randomBot } from '../sim/bot.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { setupWithPicks } from '../sim/series.ts';
import { playLikeTheGame } from '../sim/test-support.ts';
import { settle, until, visible } from './page-support.ts';

const phase = () => document.querySelector<HTMLElement>('#series')?.dataset['phase'];

describe('the result on a phone turned sideways', () => {
  it('shows Rematch, Change balls and Home without a scroll', async () => {
    // Seed 15: a short Reveal series the bot wins 2-0 (series-result.wide.browser.test.ts).
    const seed = 15;
    const decided = setupWithPicks(
      playLikeTheGame(
        {
          ruleset: RULESET_VERSION,
          seed,
          a: ['archer', 'ghost', 'speedster'],
          b: randomBot.pickLineup(seed, [...BALL_LOOKUP.keys()]),
          opponent: { kind: 'bot', bot: randomBot.id, lineupSeed: seed },
          format: 'reveal',
        },
        BALL_LOOKUP,
      ),
    );
    const params = new URLSearchParams();
    writeSeriesParams(params, decided);
    window.localStorage.setItem('ballbattle.speed', '2');
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    const start = new URL(location.href);
    start.search = `?${params.toString()}`;
    history.replaceState(null, '', start);
    await import('../main.ts');
    await document.fonts.ready;
    await settle();
    for (;;) {
      await until(() => phase() !== 'playing', 60_000, 'the round to end');
      if (phase() === 'finished') break;
      await browserPage.getByRole('button', { name: /^(Play round|↻ Replay round)/ }).click();
      await until(() => phase() === 'playing', 5_000, 'the next round to start');
    }
    await settle();
    await new Promise((resolve) => setTimeout(resolve, 800));
    window.scrollTo(0, 0);
    const ways = ['Rematch', 'Change balls', 'Home'].map((name) => {
      const found = visible('#series button').find((node) =>
        node.textContent.trim().startsWith(name),
      );
      const box = found?.getBoundingClientRect();
      return { name, whole: box !== undefined && box.top >= 0 && box.bottom <= window.innerHeight };
    });
    expect(ways).toStrictEqual([
      { name: 'Rematch', whole: true },
      { name: 'Change balls', whole: true },
      { name: 'Home', whole: true },
    ]);
  }, 180_000);
});

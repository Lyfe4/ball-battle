// The real page in a real browser (`pnpm test:browsers`): the Best of 3 result screen's three
// actions, at desktop width (the browsers-wide project, 1280 x 800, where the arena stays beside the
// result and no resize redraws it) with real clicks. Before the fix, Rematch after a Reveal series did
// nothing visible: the rematch opens on a pick, so no new match reached the arena, and the
// scoreboard only redrew on the arena's frames, which had stopped once the last round was still.
// The address changed and the health bars and speed came back under the old result.
import { describe, expect, it } from 'vitest';
import { page as browserPage } from 'vitest/browser';
import page from '../../index.html?raw';
import { writeSeriesParams } from '../app/series-url.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { randomBot } from '../sim/bot.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { setupWithPicks } from '../sim/series.ts';
import { playLikeTheGame } from '../sim/test-support.ts';
import { button, settle, until, visible } from './page-support.ts';

const phase = () => document.querySelector<HTMLElement>('#series')?.dataset['phase'];
const score = () => visible('.series-track-points')[0]?.textContent;

/** Plays the replayed link to its result: Play round whenever the screen offers it. */
async function playToResult(): Promise<void> {
  for (;;) {
    await until(() => phase() !== 'playing', 60_000);
    if (phase() === 'finished') return;
    await browserPage.getByRole('button', { name: /^(Play round|↻ Replay round)/ }).click();
    await until(() => phase() === 'playing', 5_000);
  }
}

/** Opens a link inside the page, as a Back or Forward to it would. */
async function open(search: string): Promise<void> {
  const entry: unknown = history.state;
  history.pushState(entry, '', `${location.pathname}${search}`);
  window.dispatchEvent(new PopStateEvent('popstate', { state: entry }));
  await settle();
}

describe('the Best of 3 result screen', () => {
  it('Copy link, Rematch and New series each do what they say', async () => {
    // Seed 15: a short Reveal series the bot wins 2-0, the bot showing first in round 1.
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
    const link = `?${params.toString()}`;

    window.localStorage.setItem('ballbattle.speed', '2');
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    const start = new URL(location.href);
    start.search = link;
    history.replaceState(null, '', start);
    await import('../main.ts');
    await playToResult();

    // The result: no health bars or speed under it.
    expect(visible('.hud-ball-name')).toHaveLength(0);
    expect(visible('#hud-speed button')).toHaveLength(0);

    // Copy link: the decided series' link.
    let copied = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          copied = text;
          return Promise.resolve();
        },
      },
    });
    await browserPage.getByRole('button', { name: /^Copy link/ }).click();
    await settle();
    expect(copied).toBe(location.href);
    expect(new URL(copied).searchParams.get('picks')).toBe(decided.picks?.join(','));
    expect(button('Link copied')).toBeDefined();

    // Rematch: round 1 of a new series, on screen at once, with the toss.
    await browserPage.getByRole('button', { name: 'Rematch' }).click();
    await settle();
    expect(phase()).not.toBe('finished');
    expect(score()).toBe('0 – 0');
    expect(visible('.series-result')).toHaveLength(0);
    if (phase() === 'between') {
      expect(visible('.series-toss')).toHaveLength(1);
      expect(visible('#series .pick-row').length).toBeGreaterThan(0);
      await browserPage
        .getByRole('button', { name: /^(Play|Show) / })
        .first()
        .click();
      await settle();
    }
    expect(phase()).toBe('playing');
    expect(visible('.hud-ball-name')).toHaveLength(2);

    // New series: back to the lineup, with this series' lineup and format kept.
    await open(link);
    await playToResult();
    await browserPage.getByRole('button', { name: 'New series' }).click();
    await settle();
    const url = new URL(location.href).searchParams;
    expect(url.get('step')).toBe('lineup');
    expect(url.get('fmt')).toBe('reveal');
    expect(visible('.lineup-tray-name').map((name) => name.textContent)).toStrictEqual([
      'Archer',
      'Ghost',
      'Speedster',
    ]);
  }, 180_000);
});

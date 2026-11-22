// Reveal's coin toss and the picks between rounds on a phone turned sideways (812 x 375 and, in
// browsers-landscape-small, 667 x 320; ADR 0061, 0067). On an iPhone the toss opened below the
// fold: the screen started at its top and the coin and its result needed a scroll. Between rounds
// the full track took the screen and pushed the picks below it. Here, at scroll 0: the whole toss
// (its coin's rise included) with its result, then the score line in place of the track and the
// first pick whole on screen, round 1 and round 2 alike, the track a tap away.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import page from '../../index.html?raw';
import { BOT_LEVEL_STORAGE_KEY } from '../app/bot-level.ts';
import { SPEED_STORAGE_KEY } from '../app/speed.ts';
import { button, frames, settle, tossed, until, visible } from './page-support.ts';

const click = (target: Element) => userEvent.click(target, { timeout: 10_000 });

/** Whether `part` is whole inside the screen, the page unscrolled. */
function onScreen(part: Element | undefined): boolean {
  const box = part?.getBoundingClientRect();
  return (
    box !== undefined &&
    box.height > 0 &&
    box.top >= 0 &&
    box.bottom <= window.innerHeight + 0.5 &&
    window.scrollY === 0
  );
}

/** A pick screen: the score line, no track until it is opened, the banner and a whole pick. */
async function checkPicks(step: string, round: string): Promise<void> {
  await frames(2);
  const line = visible(`${step} .series-bar-score`)[0];
  const track = document.querySelector(`${step} > .series-track`);
  expect({
    line: line?.textContent.replace('▾', '').trim(),
    lineShown: onScreen(line),
    track: track === null ? 'none' : getComputedStyle(track).display,
    banner: onScreen(visible(`${step} .series-banner`)[0]),
    firstPick: onScreen(visible(`${step} .pick-row`)[0]),
  }).toStrictEqual({
    line: expect.stringMatching(new RegExp(`^${round} · You [0-9]–[0-9] Bot$`)) as string,
    lineShown: true,
    track: 'none',
    banner: true,
    firstPick: true,
  });
  // The track is a tap away, under the line.
  if (line === undefined) throw new Error('No score line');
  await click(line);
  await frames(2);
  expect(getComputedStyle(track ?? document.body).display).not.toBe('none');
  await click(line);
  await frames(2);
}

describe('a Reveal series on a phone turned sideways', () => {
  it('shows the whole toss, then the picks without a scroll', async () => {
    window.localStorage.setItem(BOT_LEVEL_STORAGE_KEY, 'normal');
    window.localStorage.setItem(SPEED_STORAGE_KEY, '2');
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    const start = new URL(location.href);
    start.search = '?mode=bo3&fmt=reveal&step=lineup&la=storm,venom,quake';
    history.replaceState(null, '', start);
    await import('../main.ts');
    await settle();

    button('Reveal lineups').click();
    // The toss, at its highest and once landed: the coin's whole stage and the result line.
    await until(
      () => visible('.coin-toss[data-stage="flipping"]').length === 1,
      10_000,
      'the coin in the air',
      false,
    );
    const stage = () => visible('.coin-toss .coin-toss-stage')[0];
    expect({ flipping: onScreen(stage()) }).toStrictEqual({ flipping: true });
    await until(
      () => visible('.coin-toss[data-stage="landed"]').length === 1,
      10_000,
      'the coin to land',
      false,
    );
    await frames(2);
    expect({
      stage: onScreen(stage()),
      words: onScreen(visible('.coin-toss .coin-toss-words')[0]),
      result: visible('.coin-toss .coin-toss-words')[0]?.textContent,
    }).toStrictEqual({
      stage: true,
      words: true,
      result: expect.stringMatching(/shows first$/) as string,
    });

    await tossed();
    await settle();
    await checkPicks('.answer-step', 'Round 1');

    // Round 1 fought, then round 2's picks on the round screen.
    visible('.answer-step .pick-row-pick')[0]?.click();
    await until(() => visible('.ready-card').length === 1, 10_000, 'the ready card', false);
    await click(button('Fight!'));
    const phase = () => document.querySelector<HTMLElement>('#series')?.dataset['phase'];
    await until(() => phase() === 'playing', 10_000, 'the round to start', false);
    await until(() => phase() !== 'playing', 90_000, 'the round to end', false);
    await until(() => visible('#series .pick-row').length > 0, 20_000, 'round 2’s picks', false);
    await settle();
    await checkPicks('#series', 'Round 2');
  }, 180_000);
});

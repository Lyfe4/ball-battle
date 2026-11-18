// The slow-frames line (ADR 0063 addendum): a fight drawn at about 30 frames a second for a
// sustained stretch (Low Power Mode, battery saver) earns one line after it, under the court; a
// single stall at 60 never does, and the line is shown once per device. The page's animation frames
// are held to a beat on a clock of their own (each frame stamped one beat after the last, delivered
// at once), so the beat is exact on every engine and a fight takes a few seconds of real time.
import { describe, expect, it } from 'vitest';
import page from '../../index.html?raw';
import { FRAME_TIP_STORAGE_KEY, READY_CARD_STORAGE_KEY } from '../app/tips.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { WHOLE_RUN_TIMEOUT_MS } from '../sim/test-support.ts';
import { FRAME_TIP_TEXT } from '../ui/frame-tip.ts';
import { button, settle, until, visible } from './page-support.ts';

/** The frames' beat now, and a one-off stall (ms) for the next frame. */
const clock = { beat: 1000 / 60, stall: 0 };

function holdFrames(): void {
  let queue: FrameRequestCallback[] = [];
  let at = performance.now();
  const tick = () => {
    const due = queue;
    queue = [];
    at += clock.beat + clock.stall;
    clock.stall = 0;
    for (const callback of due) callback(at);
    setTimeout(tick, 2);
  };
  window.requestAnimationFrame = (callback) => {
    queue.push(callback);
    return queue.length;
  };
  setTimeout(tick, 2);
}

const tip = () => document.querySelector<HTMLElement>('#frame-tip');
const tipShows = () => visible('#frame-tip').length > 0;
const resultShows = () => visible('.hud-actions button').length > 0;

/** Plays the match on screen to its result; `during` runs on the way. */
async function playToResult(during: () => void = () => undefined): Promise<void> {
  await until(
    () => {
      during();
      return resultShows();
    },
    WHOLE_RUN_TIMEOUT_MS / 2,
    'the match result',
  );
  // The Winner sticker's moment, after which the line may show.
  await new Promise((resolve) => setTimeout(resolve, 1_000));
}

describe('the slow-frames line', () => {
  it(
    'shows once after a fight at 30 a second, under the court, never for one stall',
    async () => {
      window.localStorage.setItem(READY_CARD_STORAGE_KEY, 'off');
      window.localStorage.setItem('ballbattle.speed', '2');
      holdFrames();
      // Shown only when the result already shows: never during a fight.
      const shownWithout: boolean[] = [];
      const body = new DOMParser().parseFromString(page, 'text/html').body;
      document.body.replaceChildren(...body.children);
      new MutationObserver(() => {
        if (tipShows()) shownWithout.push(!resultShows());
      }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
      const start = new URL(location.href);
      start.search = `?a=brawler&b=magnet&seed=4&v=${String(RULESET_VERSION)}`;
      history.replaceState(null, '', start);
      await import('../main.ts');
      await settle();

      // At 60 a second with one long stall mid-fight: no line.
      let frames = 0;
      await playToResult(() => {
        frames += 1;
        if (frames === 10) clock.stall = 600;
      });
      expect(tipShows()).toBe(false);
      expect(window.localStorage.getItem(FRAME_TIP_STORAGE_KEY)).toBeNull();

      // At 30 a second: the line once the fight is over.
      clock.beat = 1000 / 30;
      button('Replay').click();
      await until(() => !resultShows(), 5_000, 'the replay to start');
      await playToResult();
      await until(tipShows, 5_000, 'the slow-frames line');
      const line = tip();
      if (line === null) throw new Error('No #frame-tip');
      expect(line.textContent).toBe(FRAME_TIP_TEXT);
      expect(line.getAttribute('role')).toBe('status');
      expect(shownWithout).not.toContain(true);
      // Under the court, never over it, and two lines at most at 375 wide.
      const court = document.querySelector('#arena')?.getBoundingClientRect();
      const box = line.getBoundingClientRect();
      expect(court).toBeDefined();
      expect(box.top).toBeGreaterThanOrEqual(court?.bottom ?? Infinity);
      const style = getComputedStyle(line);
      const text = box.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      expect(Math.round(text / parseFloat(style.lineHeight))).toBeLessThanOrEqual(2);
      expect(box.right).toBeLessThanOrEqual(document.documentElement.clientWidth);
      expect(window.localStorage.getItem(FRAME_TIP_STORAGE_KEY)).toBe('seen');

      // The next fight clears it, and it never shows again, however slow.
      button('Replay').click();
      await until(() => !tipShows() && !resultShows(), 5_000, 'the replay to start');
      await playToResult();
      expect(tipShows()).toBe(false);
    },
    WHOLE_RUN_TIMEOUT_MS * 2,
  );
});

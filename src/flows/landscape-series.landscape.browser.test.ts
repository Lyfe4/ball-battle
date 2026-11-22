// A phone turned sideways mid-series (812 x 375 with touch, ADR 0067 and its 2026-11-22 addendum):
// a series round fits beside the court with the phone's score line, speed and Leave series on one
// row, and the panel scrolls inside itself, so the page never scrolls (a moving browser bar would
// change `100dvh` and resize the court). The court keeps its size across a panel scroll.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import page from '../../index.html?raw';
import { BOT_LEVEL_STORAGE_KEY } from '../app/bot-level.ts';
import { SPEED_STORAGE_KEY } from '../app/speed.ts';
import { atRest, button, frames, settle, tossed, until, visible } from './page-support.ts';

const click = (target: Element) => userEvent.click(target, { timeout: 10_000 });
const phase = () => document.querySelector<HTMLElement>('#series')?.dataset['phase'];
const courtBox = () => {
  const court = document.getElementById('arena')?.getBoundingClientRect();
  return court === undefined ? '' : `${String(court.width)} x ${String(court.height)}`;
};

/** Every part of the fight that matters, by name, and whether it is on screen. */
function onScreen(): Record<string, boolean> {
  const parts: Record<string, HTMLElement | undefined> = {
    court: document.getElementById('arena') ?? undefined,
    'first bar': visible('.hud-ball')[0],
    'second bar': visible('.hud-ball')[1],
    speed: visible('#hud-speed')[0],
    'Leave series': visible('#series-exit .series-leave')[0],
    'score line': visible('#series .series-bar-score')[0],
  };
  return Object.fromEntries(
    Object.entries(parts).map(([name, part]) => {
      const box = part?.getBoundingClientRect();
      return [name, box !== undefined && box.top >= 0 && box.bottom <= window.innerHeight];
    }),
  );
}

describe('a phone turned sideways, mid-series', () => {
  it('fits a round beside the court and scrolls only the panel', async () => {
    window.localStorage.setItem(BOT_LEVEL_STORAGE_KEY, 'normal');
    // Normal speed, so the fight outlasts its checks in a slow, loaded browser.
    window.localStorage.setItem(SPEED_STORAGE_KEY, '1');
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    const start = new URL(location.href);
    start.search = '?mode=bo3&fmt=showdown&step=lineup&la=storm,venom,quake';
    history.replaceState(null, '', start);
    await import('../main.ts');
    await settle();

    button('Reveal lineups').click();
    await settle();
    await tossed();
    visible('.answer-step .pick-row-pick')[0]?.click();
    await until(() => visible('.ready-card').length === 1, 10_000, 'the ready card', false);
    await click(button('Fight!'));
    await settle();
    await frames(2);
    await atRest(courtBox);
    expect(phase()).toBe('playing');

    // The phone's score line, not the whole track; speed and Leave series on one row.
    const track = document.querySelector('#series > .series-track');
    expect(track === null ? 'none' : getComputedStyle(track).display).toBe('none');
    const all = Object.fromEntries(Object.keys(onScreen()).map((name) => [name, true]));
    expect(onScreen()).toStrictEqual(all);
    const speed = visible('#hud-speed')[0]?.getBoundingClientRect();
    const leave = visible('#series-exit')[0]?.getBoundingClientRect();
    expect(Math.abs((speed?.top ?? 0) - (leave?.top ?? -99))).toBeLessThan(
      (speed?.height ?? 0) / 2,
    );

    // The page never scrolls; the panel does, and the court keeps its size.
    const court = courtBox();
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight);
    window.scrollTo(0, 200);
    expect(window.scrollY).toBe(0);
    const hud = document.querySelector<HTMLElement>('.hud');
    expect(getComputedStyle(hud ?? document.body).overflowY).toBe('auto');
    await click(visible('#series .series-bar-score')[0] ?? document.body);
    await settle();
    hud?.scrollTo(0, hud.scrollHeight);
    await frames(2);
    expect({ scrollY: window.scrollY, court: courtBox() }).toStrictEqual({ scrollY: 0, court });
  }, 120_000);
});

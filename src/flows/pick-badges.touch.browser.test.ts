// The real page on a touch phone (`pnpm test:browsers`, the browsers-touch project: touch on, 375 ×
// 812, real taps): on a pick row, a tap on a matchup mark shows who has the edge and why, and never
// picks; a tap on the rest of the row picks. Rows don't start a text selection or open the
// browser's own long-press menu (ADR 0037). Then the round waits on Fight!, as every series round
// does, and a tap on Fight! starts it.
import { describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import page from '../../index.html?raw';
import { button, settle, visible } from './page-support.ts';

declare module 'vitest/browser' {
  interface BrowserCommands {
    tap: (selector: string) => Promise<void>;
  }
}

const step = () => new URL(location.href).searchParams.get('step');
const tooltip = () => visible('.symbol-tooltip').map((tip) => tip.textContent);

describe('pick rows on a touch phone', () => {
  it('explains a mark on a tap, picks on a tap elsewhere on the row, then waits on Fight!', async () => {
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    const start = new URL(location.href);
    start.search = '?mode=bo3&fmt=reveal&step=lineup&la=chrono,titan,storm';
    history.replaceState(null, '', start);
    await import('../main.ts');
    await settle();
    button('Reveal lineups').click();
    await settle();
    expect(step()).toBe('answer');

    // Each mark is a 44 px tap target of its own.
    const badge = visible('.answer-step .pick-row-badge')[0];
    if (badge === undefined) throw new Error('No mark on the pick rows');
    const box = badge.getBoundingClientRect();
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);

    // A tap on the first row's first mark: both balls named, who has the edge, why. No pick.
    await commands.tap('.answer-step .pick-row-badge');
    await settle();
    const [edge, why] = tooltip()[0]?.split(/(?<=favoured|even)/) ?? [];
    expect(edge).toMatch(/^Your Chrono vs the bot’s \S+: (you’re favoured|even|.+ is favoured)/);
    expect(why?.length).toBeGreaterThan(0);
    expect(step()).toBe('answer');

    // Rows start no text selection and open no long-press menu.
    const name = visible('.answer-step .pick-row-name')[0];
    if (name === undefined) throw new Error('No row name');
    for (const type of ['selectstart', 'contextmenu']) {
      const event = new Event(type, { bubbles: true, cancelable: true });
      name.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
    const row = name.closest('.pick-row');
    if (!(row instanceof HTMLElement)) throw new Error('No row');
    const style = getComputedStyle(row);
    expect([style.userSelect, style.getPropertyValue('-webkit-user-select')]).toContain('none');

    // A tap on the row's name picks that ball; the round waits on Fight!.
    await commands.tap('.answer-step .pick-row-name');
    await settle();
    expect(step()).toBe('play');
    expect(visible('.hud-ball-name')[0]?.textContent).toContain('Chrono');
    expect(visible('.ready-fight')).toHaveLength(1);
    await commands.tap('.ready-fight');
    await settle();
    expect(visible('.ready-fight')).toHaveLength(0);
  }, 60_000);
});

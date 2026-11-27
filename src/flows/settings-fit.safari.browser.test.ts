// The settings menu fits whole mid-fight on a phone (ADR 0044, 0087 addendum of 2026-11-28),
// through the real page at 390 x 664 (browsers-safari): every row, Reduce motion and Sound
// included, shows at once with no scroll inside the menu. Too tall for the room above or below
// its gear, it covers the court (the match waits, and says so) and its gear too; it used to
// scroll in the room above the gear, hiding Show all tips again and About.
// Opens on a Free play match and never moves to another screen (CLAUDE.md).
import { describe, expect, it } from 'vitest';
import page from '../../index.html?raw';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { pressFight, settle, visible } from './page-support.ts';

describe('the settings menu mid-fight at 390 x 664', () => {
  it('fits whole, with every row, and says the match waits', async () => {
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    const start = new URL(location.href);
    start.search = `?a=venom&b=titan&seed=4&v=${String(RULESET_VERSION)}`;
    history.replaceState(null, '', start);
    await import('../main.ts');
    await document.fonts.ready;
    await settle();
    pressFight();
    await settle();

    const gear = visible('#match-actions .settings-toggle')[0];
    gear?.click();
    await settle();
    const panel = document.getElementById('settings-panel');
    if (panel === null) throw new Error('No settings menu');
    const box = panel.getBoundingClientRect();
    const court = (document.getElementById('arena') as HTMLCanvasElement).getBoundingClientRect();
    const covers =
      box.left < court.right - 1 &&
      court.left < box.right - 1 &&
      box.top < court.bottom - 1 &&
      court.top < box.bottom - 1;
    const waits = visible('.settings-paused').length === 1;
    const rows = [...panel.querySelectorAll('.settings-switch-text, .settings-again')].map(
      (node) => node.textContent,
    );
    expect({
      saysWhenItCovers: covers === waits,
      scrolls: panel.scrollHeight > panel.clientHeight + 1,
      inside: box.bottom <= window.innerHeight && box.top >= 0,
      motion: rows.some((words) => words.startsWith('Reduce motion')),
      again: rows.includes('Show all tips again'),
    }).toStrictEqual({
      saysWhenItCovers: true,
      scrolls: false,
      inside: true,
      motion: true,
      again: true,
    });
    panel.querySelector<HTMLElement>('.settings-close')?.click();
  }, 60_000);
});

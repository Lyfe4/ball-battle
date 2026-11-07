// Settings over the court hold the match (ADR 0044), through the real page at 390 x 664 with touch
// (browsers-safari). At this size the menu fits under its gear, so here it is made too tall for
// any place off the court, as on a shorter phone (375 x 635, Safari on a 375-wide iPhone): it then
// covers the court, says the match waits, and the court stands still until it closes, when the
// match carries on. Opens on a Free play match and never moves to another screen (CLAUDE.md).
import { describe, expect, it } from 'vitest';
import page from '../../index.html?raw';
import { SPEED_STORAGE_KEY } from '../app/speed.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { pressFight, settle, visible } from './page-support.ts';

const canvas = () => document.getElementById('arena') as HTMLCanvasElement;
const frame = () => canvas().toDataURL();

/** True when the court's picture changes within `ms`. */
async function courtMoves(ms: number): Promise<boolean> {
  const before = frame();
  const end = Date.now() + ms;
  while (Date.now() < end) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (frame() !== before) return true;
  }
  return false;
}

describe('settings over the court', () => {
  it('hold the match while open and let it carry on when closed', async () => {
    window.localStorage.setItem(SPEED_STORAGE_KEY, '1');
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    const start = new URL(location.href);
    start.search = `?a=venom&b=titan&seed=4&v=${String(RULESET_VERSION)}`;
    history.replaceState(null, '', start);
    await import('../main.ts');
    await settle();
    pressFight();
    await settle();
    expect(await courtMoves(2000)).toBe(true);

    // Taller than any place off the court leaves, as on a shorter phone.
    const tall = document.createElement('style');
    tall.textContent = '.settings-panel { min-height: 520px; }';
    document.head.append(tall);
    const gear = visible('#match-actions .settings-toggle')[0];
    gear?.click();
    await settle();
    const panel = document.getElementById('settings-panel');
    const box = panel?.getBoundingClientRect();
    const court = canvas().getBoundingClientRect();
    const covers =
      box !== undefined &&
      box.left < court.right &&
      court.left < box.right &&
      box.top < court.bottom &&
      court.top < box.bottom;
    expect(covers).toBe(true);
    expect(visible('.settings-paused').map((note) => note.textContent)).toStrictEqual([
      'The match waits while this is open.',
    ]);
    expect(await courtMoves(1000)).toBe(false);

    gear?.click();
    await settle();
    expect(await courtMoves(2000)).toBe(true);
    tall.remove();
  }, 60_000);
});

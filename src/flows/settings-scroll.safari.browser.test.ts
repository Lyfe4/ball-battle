// The settings menu scrolls inside itself where it is capped (settings-menu.ts, ADR 0044), through
// the real page at 390 x 664 (browsers-safari). On home the menu must cover the demo court and
// keep off its own gear, so it is capped to the room above the gear; a menu taller than that (an
// account's Online rows, stood in for here by room before its last row) scrolls. Scrolling it must
// not re-place it: re-placing lifted the cap for a moment, and the browser put the scroll back
// to the top (seen on a tablet). Opens on home and never moves to another screen (CLAUDE.md).
import { describe, expect, it } from 'vitest';
import page from '../../index.html?raw';
import { frames, settle, visible } from './page-support.ts';

describe('the settings menu', () => {
  it('stays where it is scrolled to', async () => {
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    await import('../main.ts');
    await settle();

    // Taller than the room above the gear, shorter than the screen.
    const taller = document.createElement('style');
    taller.textContent = '.settings-foot { padding-top: 200px; }';
    document.head.append(taller);
    const gear = visible('.settings-toggle')[0];
    gear?.click();
    await settle();
    const panel = document.getElementById('settings-panel');
    if (panel === null) throw new Error('No settings menu');
    expect(panel.scrollHeight).toBeGreaterThan(panel.clientHeight + 100);

    panel.scrollTop = 100;
    await frames(3);
    expect(panel.scrollTop).toBe(100);

    gear?.click();
    taller.remove();
  }, 60_000);
});

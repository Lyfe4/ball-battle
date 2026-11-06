// The real page in a real browser (`pnpm test:browsers`): the HUD names each ball in a shade of its
// own colour that reads on the page (ADR 0032). The Necromancer's dark green is 3.6:1 as it is;
// its name must reach 4.5:1 while its health bar keeps the ball's own colour.
import { describe, expect, it } from 'vitest';
import page from '../../index.html?raw';
import { contrastRatio, TEXT_CONTRAST } from '../render/contrast.ts';
import { necromancer } from '../sim/balls/necromancer.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { settle, visible } from './page-support.ts';

/** `rgb(r, g, b)` as the browser reports a computed colour, to `#rrggbb`. */
function hex(rgb: string): string {
  const parts = /(\d+),\s*(\d+),\s*(\d+)/.exec(rgb)?.slice(1) ?? [];
  return `#${parts.map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`;
}

describe('ball-coloured text in the HUD', () => {
  it('reads at 4.5:1 on the page, and the bar keeps the ball’s own colour', async () => {
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    const start = new URL(location.href);
    start.search = `?a=necromancer&b=frost&seed=3&v=${String(RULESET_VERSION)}`;
    history.replaceState(null, '', start);
    await import('../main.ts');
    await settle();

    const pageColor = hex(getComputedStyle(document.body).backgroundColor);
    const names = visible('.hud-ball-name');
    expect(names).toHaveLength(2);
    for (const name of names) {
      const ratio = contrastRatio(hex(getComputedStyle(name).color), pageColor);
      expect(ratio).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    }
    const bar = visible('.hud-health-fill')[0];
    expect(bar === undefined ? '' : hex(getComputedStyle(bar).backgroundColor)).toBe(
      necromancer.color,
    );
  }, 30_000);
});

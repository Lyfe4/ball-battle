// The tab rail on a small phone turned sideways (667 x 320, ADR 0081): all four tabs fit down the
// left with nothing cut or scrolled, and no tab screen scrolls sideways beside it.
import { describe, expect, it } from 'vitest';
import { settle } from './page-support.ts';
import { follow, onScreen, openAs, tabBar, tabLabels } from './shell-routes-support.ts';

describe('the tab rail at 667 x 320', () => {
  it('fits every tab, and every tab screen fits beside it', async () => {
    await openAs({ online: true, accounts: true }, '');
    for (const [search, screen] of [
      ['', 'home'],
      ['?view=manual', 'manual'],
      ['?view=friends', 'friends'],
      ['?view=ranks', 'ranks'],
    ] as const) {
      if (search !== '') await follow(search);
      await onScreen(screen);
      await settle();
      const rail = tabBar();
      if (rail === undefined) throw new Error(`No rail on ${screen}`);
      expect(tabLabels()).toStrictEqual(['Play', 'Balls', 'Friends', 'Ranks']);
      const box = rail.getBoundingClientRect();
      // Down the left, the screen's full height, never scrolling inside itself.
      expect(box.left).toBe(0);
      expect(box.height).toBeCloseTo(innerHeight, 0);
      expect(rail.scrollHeight, screen).toBeLessThanOrEqual(rail.clientHeight);
      for (const tab of rail.querySelectorAll('a')) {
        expect(tab.getBoundingClientRect().bottom, screen).toBeLessThanOrEqual(innerHeight);
      }
      // Nothing of the screen sideways past its edge, nor under the rail.
      expect(document.documentElement.scrollWidth, screen).toBeLessThanOrEqual(innerWidth);
      const stage = document.getElementById('stage');
      const content = [...(stage?.querySelectorAll<HTMLElement>('.hud, .arena-container') ?? [])]
        .filter((node) => node.getBoundingClientRect().width > 0)
        .map((node) => node.getBoundingClientRect().left);
      for (const left of content) expect(left, screen).toBeGreaterThanOrEqual(box.right);
    }
  });
});

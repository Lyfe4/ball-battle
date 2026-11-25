// The tab rail on a small phone turned sideways (667 x 320, ADR 0081): all four tabs fit down the
// left with nothing cut or scrolled, and no tab, browse or task screen scrolls sideways beside it
// (ADR 0087); a lineup is a task and keeps it; a fight has none.
import { describe, expect, it } from 'vitest';
import { button, settle } from './page-support.ts';
import { follow, onScreen, openAs, tabBar, tabLabels } from './shell-routes-support.ts';

describe('the tab rail at 667 x 320', () => {
  it('fits every tab, every screen but a fight fits beside it, and a fight has none', async () => {
    await openAs({ online: true, accounts: true }, '');
    for (const [search, screen] of [
      ['', 'home'],
      ['?view=manual', 'manual'],
      ['?view=friends', 'friends'],
      ['?view=ranks', 'ranks'],
      // Browsed to and tasks keep the rail beside (ADR 0087).
      ['?view=manual&ball=vampire', 'manual'],
      ['?view=profile', 'profile'],
      ['?view=signin', 'signin'],
      ['?mode=bo3', 'series'],
      ['?view=pick', 'pick'],
      // A lineup is a task (ADR 0087 addendum of 2026-11-26): the rail stays until the arena.
      ['?mode=bo3&fmt=reveal&step=lineup&la=storm,venom,quake', 'series'],
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
    // The arena takes the screen from the coin toss on: no rail (ADR 0039, 0067).
    button('Reveal lineups').click();
    await settle();
    expect(tabBar(), 'the coin toss').toBeUndefined();
  });
});

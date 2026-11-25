// The avatar on a desktop (1280 x 800, ADR 0081, 0087): in every tab screen's lead slot, the game's
// mark atop the wide rail; it opens Profile, whose Back returns to that tab.
import { describe, it } from 'vitest';
import { avatarOnEveryTab } from './shell-routes-support.ts';

describe('the avatar on a desktop', () => {
  it('sits in every tab screen’s lead slot under the rail’s mark, and Profile’s Back returns', async () => {
    await avatarOnEveryTab();
  });
});

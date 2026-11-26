// The avatar on a desktop (1280 x 800, ADR 0081, 0087 addendum of 2026-11-26): top right in every
// tab screen's header before the gear, the game's mark atop the wide rail; it opens Profile, whose
// Back returns to that tab.
import { describe, it } from 'vitest';
import { avatarOnEveryTab } from './shell-routes-support.ts';

describe('the avatar on a desktop', () => {
  it('sits top right in every tab screen’s header, the mark on the rail, and Profile’s Back returns', async () => {
    await avatarOnEveryTab();
  });
});

// The avatar on every tab screen of a phone held upright (390 x 664, ADR 0081, 0087 addendum of
// 2026-11-26): top right in each tab screen's header before the gear, the game's mark leading the
// row; it opens Profile, whose Back returns to the tab it came from.
import { describe, it } from 'vitest';
import { avatarOnEveryTab } from './shell-routes-support.ts';

describe('the avatar on a phone', () => {
  it('shows top right in every tab screen’s header, and Profile’s Back returns to that tab', async () => {
    await avatarOnEveryTab();
  });
});

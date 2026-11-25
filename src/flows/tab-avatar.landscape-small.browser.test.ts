// The avatar beside (a small phone turned sideways, 667 x 320, ADR 0081, 0087): in the header row's
// lead slot of every tab screen, the game's mark atop the rail; it opens Profile, whose Back returns.
import { describe, it } from 'vitest';
import { avatarOnEveryTab } from './shell-routes-support.ts';

describe('the avatar beside', () => {
  it('sits in every tab screen’s lead slot under the rail’s mark, and Profile’s Back returns', async () => {
    await avatarOnEveryTab();
  });
});

// The avatar beside (a small phone turned sideways, 667 x 320, ADR 0081, 0087 addendum of 2026-11-26):
// top right in every tab screen's header before the gear, the game's mark atop the rail; it opens
// Profile, whose Back returns.
import { describe, it } from 'vitest';
import { avatarOnEveryTab } from './shell-routes-support.ts';

describe('the avatar beside', () => {
  it('sits top right in every tab screen’s header, the mark on the rail, and Profile’s Back returns', async () => {
    await avatarOnEveryTab();
  });
});

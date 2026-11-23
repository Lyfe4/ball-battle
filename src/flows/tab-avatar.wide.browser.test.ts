// The avatar on a desktop (1280 x 800, ADR 0081): atop the wide rail on every tab screen, never in
// a header as well, opening Profile, whose Back returns to that tab.
import { describe, it } from 'vitest';
import { avatarOnEveryTab } from './shell-routes-support.ts';

describe('the avatar on a desktop', () => {
  it('tops the rail on every tab screen, and Profile’s Back returns to that tab', async () => {
    await avatarOnEveryTab('rail');
  });
});

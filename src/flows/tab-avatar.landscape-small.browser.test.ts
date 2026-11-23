// The avatar beside (a small phone turned sideways, 667 x 320, ADR 0081): atop the rail on every
// tab screen, never in a header as well, opening Profile, whose Back returns to that tab.
import { describe, it } from 'vitest';
import { avatarOnEveryTab } from './shell-routes-support.ts';

describe('the avatar beside', () => {
  it('tops the rail on every tab screen, and Profile’s Back returns to that tab', async () => {
    await avatarOnEveryTab('rail');
  });
});

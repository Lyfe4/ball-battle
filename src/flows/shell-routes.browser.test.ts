// The shell's URLs (ADR 0081) in a production build without online play: Friends, Profile and
// Ranks open home, and every older URL keeps the meaning it has in this build.
import { describe, expect, it } from 'vitest';
import { expectHome, follow, LINKS, onScreen, openAs } from './shell-routes-support.ts';

describe('the shell’s URLs without online play (production today)', () => {
  it('opens home for every shell screen and online link, and the rest as before', async () => {
    await openAs({ online: false, accounts: false }, '?view=ranks');
    await expectHome();
    for (const search of ['?view=friends', '?view=profile', '?view=ranks']) {
      await follow(search);
      await expectHome();
    }
    for (const search of [LINKS.online, LINKS.start, LINKS.challenge, LINKS.google]) {
      await follow(search);
      await expectHome();
    }
    await follow('?view=manual&tab=chart');
    await onScreen('manual');
    expect(location.search).toBe('?view=manual&tab=chart');
    // A send link's length opens the bot setup here, as it always has.
    await follow(LINKS.send);
    await onScreen('series');
  });
});

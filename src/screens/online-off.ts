// Online play's stand-in in a build without it (production with vs Friend off, ADR 0052, 0068): no
// online screen exists, and an online URL opens home in its place. It imports nothing of online
// play but Forget me, which settings still offer on a device that has a guest (ADR 0078).
import { browserStorage } from '../app/storage.ts';
import { createForgetMe } from '../ui/online/forget-me.ts';
import { forgetMeHost } from './forget-me-host.ts';
import type { OnlineMount } from './online-mount.ts';

export function offlineMount(goHome: () => void): OnlineMount {
  const toHome = {
    show: () => {
      goHome();
    },
  };
  return {
    handlers: {
      online: toHome,
      challenge: toHome,
      send: toHome,
      start: toHome,
      signin: toHome,
      friends: toHome,
    },
    avatars: undefined,
    settings: {
      online: createForgetMe(
        forgetMeHost(browserStorage, () => {
          window.location.assign('/');
        }),
      ),
    },
    settle: () => undefined,
    update: () => undefined,
    playing: () => false,
    roundOnArena: () => false,
    phase: () => undefined,
    noticeShown: () => false,
    sides: () => undefined,
    yourSide: () => undefined,
    setVisible: () => undefined,
    homeShown: () => undefined,
    // Home offers no friend without online play (PLAY_CHOICES): nothing to send.
    playFriend: () => Promise.resolve(),
    asksWho: () => false,
    isLive: () => false,
    liveRate: () => 1,
    screenChanged: () => undefined,
    footLine: (_onScreen, noSpeed) => noSpeed,
  };
}

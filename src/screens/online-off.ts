// Online play's stand-in in a build without it (production until launch, ADR 0052): no online
// screen exists, and an online URL opens home in its place. Imports nothing of online play.
import type { OnlineMount } from './online-mount.ts';

export function offlineMount(goHome: () => void): OnlineMount {
  const toHome = {
    show: () => {
      goHome();
    },
  };
  return {
    handlers: { online: toHome, challenge: toHome, send: toHome },
    settings: {},
    settle: () => undefined,
    update: () => undefined,
    playing: () => false,
    phase: () => undefined,
    sides: () => undefined,
    setVisible: () => undefined,
    homeShown: () => undefined,
    isLive: () => false,
    liveRate: () => 1,
    footLine: (_onScreen, noSpeed) => noSpeed,
  };
}

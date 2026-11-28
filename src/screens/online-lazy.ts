// Online play's code as a chunk of its own (2026-11-28 audit, section 6 item 2): about a fifth of
// the page's script, which a player who never goes online never runs. This stand-in is what main.ts
// holds in an online build. The chunk is asked for as the page starts (as the Balls manual's,
// manual-lazy.ts), so it is nearly always there before any tap, and a page that goes offline later
// still has it (there is no service worker to fetch it then).
//
// Until it lands:
// - an online screen is not shown at all: main.ts waits for `ready` before it shows one, so a cold
//   link's first paint waits for the chunk (the stage is drawn invisible until then, first-paint.ts)
//   and a move keeps the screen it leaves until the next one can show. Nothing blank, nothing
//   swapped in later: the online screen draws its own skeleton, as it always has;
// - what the page shows from the first frame is drawn here as the mount would draw it: Play's
//   place (waiting for the server on a device that has played online) and the avatar;
// - the rest answers as a page with no online series on screen.
// When it lands the mount takes over, and the page lays itself out again so the mount sees the
// screen on show. A chunk that fails to load (the network dropped as the page started) shows the
// one failure notice in the screen's place, with Try again, which asks for it again; Play shows.
import { ACCOUNTS_BUILD } from '../app/accounts-build.ts';
import { installErrorReports } from '../app/error-report-build.ts';
import { ONLINE_BUILD } from '../app/online-build.ts';
import type { FriendSetup } from '../app/modes.ts';
import { hasGuest } from '../app/online-device.ts';
import { writeSendParams } from '../app/online-url.ts';
import { writeShellParams, type Screen } from '../app/route.ts';
import type { ScreenHandler, ScreenHandlers } from '../app/router.ts';
import { browserStorage } from '../app/storage.ts';
import { getElement } from '../ui/dom.ts';
import { createAvatars } from '../ui/online/account-button.ts';
import { createForgetMe } from '../ui/online/forget-me.ts';
import { showPlayRow } from '../ui/online/play-waiting.ts';
import { forgetMeHost } from './forget-me-host.ts';
import { offlineMount } from './online-off.ts';
import { createUnloaded } from './online-unloaded.ts';
import type { MountContext, OnlineMount } from './online-mount.ts';

/** What the chunk holds: online-mount.ts. */
export interface OnlineChunk {
  mountOnline(context: MountContext): OnlineMount;
}

export interface LazyContext extends Omit<MountContext, 'avatars'> {
  /** Shows the URL's screen again (main.ts): after Try again brought the chunk. */
  reshow(): void;
}

/** The screens the mount draws (Profile and All matches with accounts only). */
type OnlineScreen = keyof OnlineMount['handlers'];

/** The screens the mount draws: none of them shows until its code has come. */
const ONLINE_SCREENS: ReadonlySet<Screen> = new Set<Screen>([
  'online',
  'challenge',
  'send',
  'start',
  'signin',
  'friends',
  ...(ACCOUNTS_BUILD ? (['profile', 'matches'] as const) : []),
]);

/** The chunk, asked for only in a build with online play (the bundler reads this condition). */
const loadChunk = (): Promise<OnlineChunk> =>
  import.meta.env.VITE_ONLINE === '1'
    ? import('./online-mount.ts')
    : Promise.reject(new Error('no online play in this build'));

/** Online play as this build has it: the stand-in for its chunk, or none (online-off.ts). */
export function onlineFor(context: LazyContext): OnlineMount {
  return ONLINE_BUILD
    ? lazyOnline(context)
    : offlineMount(() => {
        context.goHome('replace');
      });
}

export function lazyOnline(context: LazyContext, load = loadChunk): OnlineMount {
  // The page's own errors are reported from the start, chunk or not (error-report-build.ts).
  installErrorReports();
  let real: OnlineMount | undefined;
  let loading: Promise<void> | undefined;
  /** The screen on show, as the page last laid out. */
  let onScreen: Screen | undefined;

  const playRow = getElement('home', HTMLElement).querySelector<HTMLElement>('.home-play-row');
  // Play's place from the first frame, as the mount draws it (home-play-state.ts): a device that
  // has played online waits for the server; one that hasn't has nothing to go back to.
  if (playRow !== null) showPlayRow(playRow, hasGuest(browserStorage) ? 'waiting' : 'play');
  // The avatar on the tab screens (accounts builds), in its place from the first frame.
  const avatars = ACCOUNTS_BUILD
    ? createAvatars(() => {
        context.go((url) => {
          writeShellParams(url, 'profile');
        });
      })
    : undefined;
  // Settings' Forget me, in an online build without accounts (ADR 0078): it needs no chunk.
  const settings = ACCOUNTS_BUILD
    ? {}
    : {
        online: createForgetMe(
          forgetMeHost(browserStorage, () => {
            window.location.assign('/');
          }),
        ),
      };
  const hud = getElement('hud-status', HTMLElement).parentElement ?? document.body;
  const unloaded = createUnloaded(hud, {
    back: () => {
      context.navigation.back(() => {
        context.goHome();
      });
    },
    retry: async () => {
      await ask();
      if (real !== undefined) context.reshow();
    },
  });

  function ask(): Promise<void> {
    loading ??= load().then(
      (chunk) => {
        real = chunk.mountOnline({ ...context, avatars });
        unloaded.remove();
        // Laid out again, so the mount sees the screen on show; Play's place asks the server.
        if (onScreen === 'home') real.homeShown();
        context.showControls();
      },
      () => {
        // Not loaded: the next online screen (or Try again) asks again, and Play can't wait on it.
        loading = undefined;
        if (playRow !== null) showPlayRow(playRow, 'play');
      },
    );
    return loading;
  }
  void ask();

  /** An online screen's handler: the mount's once it has come, else the failure notice. */
  const handler = <S extends OnlineScreen>(screen: S): ScreenHandler<S> => {
    const mounted = (): ScreenHandler<S> | undefined => {
      const handlers: Partial<Pick<ScreenHandlers, OnlineScreen>> | undefined = real?.handlers;
      return handlers?.[screen];
    };
    return {
      show: (route, from) => {
        if (real === undefined) {
          unloaded.show(screen);
          // The online series' screen is a task's while the notice shows (shellOf): laid out again.
          context.showControls();
        } else mounted()?.show(route, from);
      },
      leave: () => {
        mounted()?.leave?.();
      },
    };
  };

  return {
    handlers: {
      online: handler('online'),
      challenge: handler('challenge'),
      send: handler('send'),
      start: handler('start'),
      signin: handler('signin'),
      friends: handler('friends'),
      ...(ACCOUNTS_BUILD ? { profile: handler('profile'), matches: handler('matches') } : {}),
    },
    avatars,
    settings,
    ready: (screen) => (real !== undefined || !ONLINE_SCREENS.has(screen) ? undefined : ask()),
    settle: (world) => {
      real?.settle(world);
    },
    update: (world, celebrated) => {
      real?.update(world, celebrated);
    },
    playing: () => real?.playing() ?? false,
    roundOnArena: () => real?.roundOnArena() ?? false,
    phase: () => real?.phase(),
    noticeShown: () => real?.noticeShown() ?? unloaded.shown(),
    sides: () => real?.sides(),
    yourSide: () => real?.yourSide(),
    setVisible: (screen) => {
      onScreen = screen;
      if (real === undefined) unloaded.setVisible(screen);
      else real.setVisible(screen);
    },
    homeShown: () => {
      real?.homeShown();
    },
    // Busy on Play until the chunk has come; if it can't, the send screen says so with Try again.
    playFriend: (setup: FriendSetup) =>
      ask().then(() => {
        if (real !== undefined) return real.playFriend(setup);
        context.go((url) => {
          writeSendParams(url, setup.format, setup.bestOf);
        });
        return undefined;
      }),
    asksWho: () => real?.asksWho() ?? false,
    isLive: () => real?.isLive() ?? false,
    liveRate: (playedMs) => real?.liveRate(playedMs) ?? 1,
    screenChanged: (screen, now) => {
      real?.screenChanged(screen, now);
    },
    footLine: (shown, noSpeed) => real?.footLine(shown, noSpeed) ?? noSpeed,
  };
}

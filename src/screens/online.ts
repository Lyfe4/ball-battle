// Online play's screens wired to the page (ADR 0052): an online series, a friend's challenge,
// sending one, home's "Your turn" and settings' "Forget me". main.ts creates this only in a build
// with online play (`ONLINE_BUILD`), so a production build holds none of it. Its parts of the page
// are added here, beside the offline screens' own.
import { callApi } from '../app/api.ts';
import type { Navigation } from '../app/navigation.ts';
import { forgetDevice, hasGuest, type DeviceStorage } from '../app/online-device.ts';
import { writeOnlineSeriesParams } from '../app/online-url.ts';
import type { ScreenHandler } from '../app/router.ts';
import type { SeriesList } from '../api/series.ts';
import type { BallDefinition, DefinitionLookup, WorldState } from '../sim/types.ts';
import { element } from '../ui/dom.ts';
import { createForgetMe, type ForgetMe } from '../ui/online/forget-me.ts';
import { createYourTurn, type YourTurn } from '../ui/online/your-turn.ts';
import { createChallengeScreens } from './online-challenge.ts';
import { createOnlinePlay, type OnlinePlay } from './online-play.ts';

export interface OnlineHost {
  readonly navigation: Navigation;
  go(write: (params: URLSearchParams) => void): void;
  replaceWith(write: (params: URLSearchParams) => void): void;
  home(): void;
  modes(): void;
  showWorld(world: WorldState, seed: number): void;
  worldsShown(): number;
  layoutChanged(): void;
  redraw(): void;
  readonly storage: DeviceStorage;
}

export interface OnlineScreens {
  readonly online: ScreenHandler<'online'>;
  readonly challenge: ScreenHandler<'challenge'>;
  readonly send: ScreenHandler<'send'>;
  readonly play: OnlinePlay;
  readonly yourTurn: YourTurn & { refresh(): void };
  readonly forgetMe: ForgetMe;
  /** Shows the online screen parts for `screen` and hides the rest. */
  setVisible(screen: string): void;
}

export function createOnlineScreens(
  hud: HTMLElement,
  foot: HTMLElement,
  balls: readonly BallDefinition[],
  lookup: DefinitionLookup,
  host: OnlineHost,
): OnlineScreens {
  const section = (id: string, label: string) => {
    const node = element('section', '');
    node.id = id;
    node.setAttribute('aria-label', label);
    node.hidden = true;
    return node;
  };
  const challengeNotice = section('online-challenge', 'Challenge');
  const lineupRoot = section('online-lineup', 'Your lineup');
  const seriesNotice = section('online-series-notice', 'Online series');
  const panel = section('online-series', 'Online series');
  const exit = element('div', 'series-exit');
  exit.hidden = true;
  // Beside the offline screens: before the health bars, and the way out under them.
  const status = hud.querySelector('#hud-status');
  for (const node of [challengeNotice, lineupRoot, seriesNotice, panel]) {
    hud.insertBefore(node, status);
  }
  foot.append(exit);

  const home = () => {
    host.home();
  };
  const play = createOnlinePlay({ panel, exit, notice: seriesNotice }, lookup, { ...host, home });
  const challenges = createChallengeScreens(
    { notice: challengeNotice, lineup: lineupRoot },
    balls,
    {
      go: (write) => {
        host.go(write);
      },
      replaceWith: (write) => {
        host.replaceWith(write);
      },
      back: (toParent) => {
        host.navigation.back(toParent);
      },
      home,
      modes: () => {
        host.modes();
      },
      storage: host.storage,
    },
  );

  const turns = createYourTurn((id) => {
    host.go((url) => {
      writeOnlineSeriesParams(url, id);
    });
  });
  const yourTurn = {
    ...turns,
    /** Asks for the player's series, only on a device that has played online. */
    refresh() {
      if (!hasGuest(host.storage)) {
        turns.show([], Date.now());
        return;
      }
      void callApi<SeriesList>('GET', 'series').then((answer) => {
        if (answer.ok && answer.body !== undefined) turns.show(answer.body.series, Date.now());
      });
    },
  };

  const forgetMe = createForgetMe({
    hasGuest: () => hasGuest(host.storage),
    forget: async () => {
      const answer = await callApi('DELETE', 'me');
      if (!answer.ok && answer.kind === 'offline') return false;
      // Deleted, or already gone (401): this device forgets it too, and starts afresh.
      forgetDevice(host.storage);
      window.location.assign('/');
      return true;
    },
  });

  return {
    online: {
      show: (route) => {
        play.open(route.series);
      },
      leave: () => {
        play.leave();
      },
    },
    challenge: {
      show: (route) => {
        challenges.showChallenge(route.token, route.step);
      },
    },
    send: {
      show: (route) => {
        challenges.showSend(route.format, route.bestOf);
      },
    },
    play,
    yourTurn,
    forgetMe,
    setVisible(screen) {
      challenges.setVisible(screen === 'challenge' || screen === 'send');
      play.setVisible(screen === 'online');
    },
  };
}

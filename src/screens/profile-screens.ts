// Profile and All matches (ADR 0081, 0089), the account's two screens: made only in a build with
// accounts (production with vs Friend on and accounts off holds none of their code,
// `scripts/check-bundle.ts`), each with its handler for the router. Profile opens All matches; All
// matches' Back goes to Profile, even from a cold link.
import { callApi } from '../app/api.ts';
import type { Navigation } from '../app/navigation.ts';
import type { DeviceStorage } from '../app/online-device.ts';
import { writeSignInParams } from '../app/online-url.ts';
import { writeShellParams } from '../app/route.ts';
import type { ScreenHandler } from '../app/router.ts';
import type { WhoSource } from '../app/who-source.ts';
import type { MatchesPage, RecordResponse } from '../api/record.ts';
import type { DefinitionLookup } from '../sim/types.ts';
import { createAllMatches } from './all-matches.ts';
import { forgetMeHost } from './forget-me-host.ts';
import { logOut } from './log-out.ts';
import { createProfile } from './profile.ts';

export interface ProfileScreensHost {
  readonly storage: DeviceStorage;
  readonly who: WhoSource;
  readonly navigation: Navigation;
  readonly go: (write: (url: URLSearchParams) => void) => void;
  readonly lookup: DefinitionLookup;
  /** In-app Back: the previous screen, else Play. */
  readonly back: () => void;
  readonly home: () => void;
  /** A finished series' own screen, once read (online-prime.ts): Watch again there. */
  readonly openSeries: (id: string) => Promise<unknown>;
}

export interface ProfileScreens {
  readonly profile: ScreenHandler<'profile'>;
  readonly matches: ScreenHandler<'matches'>;
  setVisible(screen: string): void;
}

export function createProfileScreens(
  roots: {
    readonly notice: HTMLElement;
    readonly loading: HTMLElement;
    readonly matches: HTMLElement;
  },
  host: ProfileScreensHost,
): ProfileScreens {
  const startAfresh = () => {
    window.location.assign('/');
  };
  const to = (view: 'profile' | 'matches') => () => {
    host.go((url) => {
      writeShellParams(url, view);
    });
  };
  const profile = createProfile(
    { notice: roots.notice, loading: roots.loading },
    {
      storage: host.storage,
      who: host.who,
      back: host.back,
      home: host.home,
      signIn: () => {
        host.go(writeSignInParams);
      },
      cookies: () => document.cookie,
      logOut: () => logOut(host.storage, startAfresh),
      forget: () => forgetMeHost(host.storage, startAfresh).forget(),
      lookup: host.lookup,
      openSeries: host.openSeries,
      allMatches: to('matches'),
    },
  );
  const matches = createAllMatches(roots.matches, {
    back: () => {
      host.navigation.back(to('profile'));
    },
    record: () => callApi<RecordResponse>('GET', 'me/record'),
    page: (cursor) => callApi<MatchesPage>('GET', `me/matches?after=${encodeURIComponent(cursor)}`),
    open: host.openSeries,
    notAnAccount: to('profile'),
  });
  return {
    profile: {
      show: () => {
        profile.show();
      },
    },
    matches: {
      show: () => {
        matches.show();
      },
    },
    setVisible(screen) {
      profile.setVisible(screen === 'profile');
      matches.setVisible(screen === 'matches');
    },
  };
}

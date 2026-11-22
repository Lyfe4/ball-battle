// Online play's URLs (ADR 0052), in builds that have it:
// - `?online=<series id>`: a series by turns, played on the series screens.
// - `?challenge=<token>`: a friend's link (the card that says who sent it and what it is, with
//   Accept). The sender's own link opens the same card, which offers to share it (the lobby).
// - `?view=send&fmt=<format>&mode=bo3|bo5`: the vs Friend setup (its length and format, ADR 0055),
//   which sends the challenge.
// - `?start=<id>`: the lineups picked together once a live challenge or rematch is agreed (ADR
//   0080). Old URLs with `step=lineup` or `rematch=` open the card or the setup.
// - `?view=signin` (ADR 0079, in builds with accounts): signing in, and `&google=<result>` where
//   Google's callback sends the page back.
// Nothing secret is in any of them: the series id needs a session that plays in it, and the token
// is the link itself, meant to be shared.
import { isGoogleResult, type GoogleResult } from '../api/accounts.ts';
import { isChallengeToken } from '../api/challenges.ts';
import { ACCOUNTS_BUILD } from './accounts-build.ts';
import { FORMATS, type BestOf, type Format } from '../sim/series.ts';
import { readMode } from './series-url.ts';

export type OnlineRoute =
  | { readonly screen: 'online'; readonly series: string }
  /** Signing in (ADR 0079); `google` is how a Google sign-in just went. */
  | { readonly screen: 'signin'; readonly google: GoogleResult | undefined }
  | { readonly screen: 'challenge'; readonly token: string }
  | { readonly screen: 'send'; readonly format: Format; readonly bestOf: BestOf }
  /** Lineups picked together (ADR 0080). */
  | { readonly screen: 'start'; readonly id: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function clear(params: URLSearchParams): void {
  for (const key of [...params.keys()]) params.delete(key);
}

export function writeOnlineSeriesParams(params: URLSearchParams, id: string): void {
  clear(params);
  params.set('online', id);
}

export function writeChallengeParams(params: URLSearchParams, token: string): void {
  clear(params);
  params.set('challenge', token);
}

export function writeSendParams(params: URLSearchParams, format: Format, bestOf: BestOf): void {
  clear(params);
  params.set('view', 'send');
  params.set('fmt', format);
  params.set('mode', bestOf === 5 ? 'bo5' : 'bo3');
}

export function writeStartParams(params: URLSearchParams, id: string): void {
  clear(params);
  params.set('start', id);
}

/** The sign-in screen, as a link or Back reaches it: no Google result. */
export function writeSignInParams(params: URLSearchParams): void {
  clear(params);
  params.set('view', 'signin');
}

/**
 * The online screen a URL names, if any; anything malformed names none (and falls to home).
 * `accounts` is whether this build has accounts: without them the sign-in screen is home.
 */
export function parseOnlineRoute(
  params: URLSearchParams,
  accounts = ACCOUNTS_BUILD,
): OnlineRoute | undefined {
  const series = params.get('online')?.trim().toLowerCase();
  if (series !== undefined) return UUID.test(series) ? { screen: 'online', series } : undefined;
  const start = params.get('start')?.trim().toLowerCase();
  if (start !== undefined) return UUID.test(start) ? { screen: 'start', id: start } : undefined;
  const token = params.get('challenge')?.trim();
  if (token !== undefined) {
    return isChallengeToken(token) ? { screen: 'challenge', token } : undefined;
  }
  const view = params.get('view')?.trim().toLowerCase();
  if (view === 'signin' && accounts) {
    const google = params.get('google');
    return { screen: 'signin', google: isGoogleResult(google) ? google : undefined };
  }
  if (view !== 'send') return undefined;
  const format =
    FORMATS.find((name) => name === params.get('fmt')?.trim().toLowerCase()) ?? 'reveal';
  const bestOf = readMode(params.get('mode')) ?? 3;
  return { screen: 'send', format, bestOf };
}

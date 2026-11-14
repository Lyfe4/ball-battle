// Online play's URLs (ADR 0052), in builds that have it:
// - `?online=<series id>`: a series by turns, played on the series screens.
// - `?challenge=<token>`: a friend's link (the card that says who sent it and what it is), and
//   `&step=lineup` to build the lineup that accepts it. The sender's own link opens the same card,
//   which offers to share it.
// - `?view=send&fmt=<format>&mode=bo3|bo5`: building the lineup for a challenge to send.
// Nothing secret is in any of them: the series id needs a session that plays in it, and the token
// is the link itself, meant to be shared.
import { isChallengeToken } from '../api/challenges.ts';
import { FORMATS, type BestOf, type Format } from '../sim/series.ts';
import { readMode } from './series-url.ts';

export type OnlineRoute =
  | { readonly screen: 'online'; readonly series: string }
  | { readonly screen: 'challenge'; readonly token: string; readonly step: 'card' | 'lineup' }
  | { readonly screen: 'send'; readonly format: Format; readonly bestOf: BestOf };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function clear(params: URLSearchParams): void {
  for (const key of [...params.keys()]) params.delete(key);
}

export function writeOnlineSeriesParams(params: URLSearchParams, id: string): void {
  clear(params);
  params.set('online', id);
}

export function writeChallengeParams(
  params: URLSearchParams,
  token: string,
  step: 'card' | 'lineup' = 'card',
): void {
  clear(params);
  params.set('challenge', token);
  if (step === 'lineup') params.set('step', 'lineup');
}

export function writeSendParams(params: URLSearchParams, format: Format, bestOf: BestOf): void {
  clear(params);
  params.set('view', 'send');
  params.set('fmt', format);
  params.set('mode', bestOf === 5 ? 'bo5' : 'bo3');
}

/** The online screen a URL names, if any; anything malformed names none (and falls to home). */
export function parseOnlineRoute(params: URLSearchParams): OnlineRoute | undefined {
  const series = params.get('online')?.trim().toLowerCase();
  if (series !== undefined) return UUID.test(series) ? { screen: 'online', series } : undefined;
  const token = params.get('challenge')?.trim();
  if (token !== undefined) {
    if (!isChallengeToken(token)) return undefined;
    const step = params.get('step') === 'lineup' ? 'lineup' : 'card';
    return { screen: 'challenge', token, step };
  }
  if (params.get('view')?.trim().toLowerCase() !== 'send') return undefined;
  const format =
    FORMATS.find((name) => name === params.get('fmt')?.trim().toLowerCase()) ?? 'reveal';
  return { screen: 'send', format, bestOf: readMode(params.get('mode')) ?? 3 };
}

// What this page knows of the player's live match this visit (ADR 0089 addendum of 2026-11-27, the
// setup phase): the lineup, match or lobby a screen of its own last showed, or what `/me/match`
// last said. Home shows a known match's way back at once instead of a Play it can't vouch for
// (home-play-state.ts), then asks. In memory only, in the visit cache: gone with the page, and
// cleared with everything else when who the player is changes.
import { LOBBY_SEEN_MS, type CurrentMatch } from '../api/live.ts';
import type { ChallengeInfo } from '../api/challenges.ts';
import type { SeriesView } from '../api/series.ts';
import { visitCache, type VisitKey } from './visit-cache.ts';

/** What was learnt, and (a lobby) until when by this device's clock it can still be waiting. */
interface Known {
  readonly match: CurrentMatch | null;
  readonly until?: number;
}

const LIVE_MATCH: VisitKey<Known> = { name: 'live-match' };

/**
 * The player is in `match` (a screen showed it, or the server said), or in nothing (`null`). A
 * lobby is known only until it would stop unless its page is heard from (`stopsInMs`, a duration
 * from now: one device's clock, so clocks never differ).
 */
export function rememberLive(match: CurrentMatch | null, now = Date.now()): void {
  const stops = match?.kind === 'lobby' ? match.stopsInMs : undefined;
  visitCache.write(LIVE_MATCH, stops === undefined ? { match } : { match, until: now + stops });
}

/** What this visit last learnt: a match, nothing, or not learnt (undefined, or a lobby gone stale). */
export function knownLive(now = Date.now()): CurrentMatch | null | undefined {
  const known = visitCache.read(LIVE_MATCH);
  if (known?.until !== undefined && now >= known.until) return undefined;
  return known?.match;
}

/** A live series a screen showed: open, the way back to it; over, nothing. */
export function rememberSeries(view: SeriesView): void {
  if (view.live == null) return;
  rememberLive(
    view.status === 'open'
      ? {
          kind: 'series',
          id: view.id,
          format: view.format,
          bestOf: view.bestOf,
          opponent: view.names[view.you === 'a' ? 'b' : 'a'],
        }
      : null,
  );
}

/** The sender's lobby on screen, waiting (its page keeps it open while it shows). */
export function rememberLobby(
  token: string,
  card: Pick<ChallengeInfo, 'format' | 'bestOf' | 'invitee'>,
): void {
  const { format, bestOf, invitee } = card;
  rememberLive({ kind: 'lobby', token, format, bestOf, invitee, stopsInMs: LOBBY_SEEN_MS });
}

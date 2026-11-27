// What this page knows of the player's live match this visit (ADR 0089 addendum of 2026-11-27, the
// setup phase): the lineup, match or lobby a screen of its own last showed, or what `/me/match`
// last said. Home shows a known match's way back at once instead of a Play it can't vouch for
// (home-play-state.ts), then asks. In memory only, in the visit cache: gone with the page, and
// cleared with everything else when who the player is changes.
import { LOBBY_SEEN_MS, type CurrentMatch } from '../api/live.ts';
import type { ChallengeInfo } from '../api/challenges.ts';
import type { SeriesView } from '../api/series.ts';
import { visitCache, type VisitKey } from './visit-cache.ts';

const LIVE_MATCH: VisitKey<CurrentMatch | null> = { name: 'live-match' };

/** The player is in `match` (a screen showed it, or the server said), or in nothing (`null`). */
export function rememberLive(match: CurrentMatch | null): void {
  visitCache.write(LIVE_MATCH, match);
}

/** What this visit last learnt: a match, nothing, or not learnt yet (undefined). */
export function knownLive(): CurrentMatch | null | undefined {
  return visitCache.read(LIVE_MATCH);
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

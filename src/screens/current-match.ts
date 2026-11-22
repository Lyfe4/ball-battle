// The live match or lobby a player can go back to (ADR 0053): home's "Back to your match", and the
// way back offered when starting a second one is refused. The server says which (`/me/match`);
// this only turns its answer into where to go.
import type { CurrentMatch, CurrentMatchResponse } from '../api/live.ts';
import { callApi } from '../app/api.ts';
import {
  writeChallengeParams,
  writeOnlineSeriesParams,
  writeStartParams,
} from '../app/online-url.ts';
import type { NoticeContent } from '../ui/notice-content.ts';

/** The player's live match or waiting lobby, if any; undefined when it can't be known now. */
export async function currentMatch(): Promise<CurrentMatch | null | undefined> {
  const answer = await callApi<CurrentMatchResponse>('GET', 'me/match');
  return answer.ok ? (answer.body?.match ?? null) : undefined;
}

/** The URL of a current match: its series, its lineups, or the sender's lobby (their link's card). */
export function writeMatchParams(params: URLSearchParams, match: CurrentMatch): void {
  if (match.kind === 'series') writeOnlineSeriesParams(params, match.id);
  else if (match.kind === 'start') writeStartParams(params, match.id);
  else writeChallengeParams(params, match.token);
}

/**
 * Starting a second live match was refused (`in_a_match`): say so, with the way back to the one
 * the player is in (asked for when tapped, so it is never stale) and Home.
 */
export function inAMatchCard(
  message: string,
  /** Goes to the match once its screen is read (ADR 0054). */
  toMatch: (match: CurrentMatch) => Promise<void>,
  home: () => void,
): NoticeContent {
  return {
    title: 'You’re in a match already',
    body: [message, 'One live match at a time.'],
    buttons: [
      {
        text: 'Back to your match',
        onClick: async () => {
          const match = await currentMatch();
          if (match == null) home();
          else await toMatch(match);
        },
      },
      { text: 'Home', onClick: home },
    ],
  };
}

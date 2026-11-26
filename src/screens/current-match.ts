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

/** Where a match is: a series or a start by id, a lobby by its link. */
export type MatchPlace =
  | { readonly kind: 'series'; readonly id: string }
  | { readonly kind: 'start'; readonly id: string }
  | { readonly kind: 'lobby'; readonly token: string };

/** The URL of a current match: its series, its lineups, or the sender's lobby (their link's card). */
export function writeMatchParams(params: URLSearchParams, match: MatchPlace): void {
  if (match.kind === 'series') writeOnlineSeriesParams(params, match.id);
  else if (match.kind === 'start') writeStartParams(params, match.id);
  else writeChallengeParams(params, match.token);
}

/** What was refused for being in a match already: sending a challenge, or accepting one. */
export type RefusedMove = 'send' | 'accept';

/**
 * Sending or accepting a live challenge with a lobby of one's own waiting (ADR 0086): "You already
 * challenged Jo", with Open it (the lobby) and Cancel that and send this (or accept this).
 */
export function lobbyWaitingCard(
  lobby: Extract<CurrentMatch, { kind: 'lobby' }>,
  move: RefusedMove,
  actions: {
    readonly open: () => Promise<void>;
    /** Cancels the lobby, then does the refused move again. */
    readonly replace: () => Promise<unknown>;
    readonly home: () => void;
  },
): NoticeContent {
  return {
    title:
      lobby.invitee === null
        ? 'Your challenge link is waiting'
        : `You already challenged ${lobby.invitee}`,
    body: ['One live challenge at a time.'],
    buttons: [
      { text: 'Open it', onClick: actions.open },
      {
        text: move === 'send' ? 'Cancel that and send this' : 'Cancel that and accept this',
        onClick: actions.replace,
      },
    ],
    quiet: { text: 'Home', onClick: actions.home },
  };
}

/**
 * Starting a second live match was refused (`in_a_match`) by a match or lineups under way: say so
 * in the game's words, with the way back to it (asked for when tapped, so never stale) and Home.
 */
export function inAMatchCard(
  /** Goes to the match once its screen is read (ADR 0054). */
  toMatch: (match: CurrentMatch) => Promise<void>,
  home: () => void,
  /** Why it matters here, in the game's words (sign-in has its own). */
  line = 'One live match at a time.',
): NoticeContent {
  return {
    title: 'You’re in a match already',
    body: [line],
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

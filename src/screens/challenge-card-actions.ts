// What a challenge's card can do (online-challenge-text.ts's `CardActions`), for the link `token`:
// kept apart from the challenge screens (online-challenge.ts), which hand it their moves.
import { writeOnlineSeriesParams } from '../app/online-url.ts';
import type { CardActions } from './online-challenge-text.ts';
import { challengeUrl, copyLink, shareLink } from './online-share.ts';

export interface CardMoves {
  readonly home: () => void;
  /** Accept the link on screen (the 16+ question first on a device that hasn't answered it). */
  readonly accept: () => Promise<unknown>;
  /** Into the lineups being picked for it. */
  readonly lineups: (id: string) => Promise<unknown>;
  go(write: (params: URLSearchParams) => void): void;
  /** Challenge a friend: the one vs Friend path (ADR 0089 addendum of 2026-11-27), `id` picked. */
  readonly friend: (id?: string) => void;
  /** Cancel challenge, on the waiting screen. */
  readonly cancel: () => Promise<unknown>;
  readonly unblock: (pair: string) => Promise<unknown>;
}

export function cardActionsFor(token: string, moves: CardMoves): CardActions {
  return {
    token,
    home: moves.home,
    accept: moves.accept,
    lineups: moves.lineups,
    series: (id) => {
      moves.go((url) => {
        writeOnlineSeriesParams(url, id);
      });
    },
    sendOwn: () => {
      moves.friend();
    },
    sendAgain: (id) => {
      moves.friend(id);
    },
    share: () => shareLink(token),
    url: challengeUrl(token),
    canShare: typeof navigator.share === 'function',
    copy: () => copyLink(token),
    cancel: moves.cancel,
    unblock: moves.unblock,
  };
}

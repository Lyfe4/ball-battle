// The incoming banner's words (ADR 0086), pure: a friend's live challenge, the sender who stopped
// waiting, and a rematch asked, agreed or ended. One banner, one look (incoming-banner.ts).
import type { Invite } from '../api/friends.ts';
import { challengesYou } from './friends-text.ts';
import { challengeLine } from './online-text.ts';
import type { RematchNotice } from './rematch-text.ts';

/** What the banner says now. */
export interface Incoming {
  /** Who it is from: their disc's letter. */
  readonly who: string;
  /** "Alex challenges you", "Alex wants a rematch", "Alex stopped waiting". */
  readonly title: string;
  /** The rules ("Best of 3 · Reveal · live"), or what to do next. */
  readonly line: string;
  /**
   * The buttons: No thanks and Accept (`answer`), Choose lineup (`lineup`), or OK (`ok`, news that
   * needs no answer).
   */
  readonly answers: 'answer' | 'lineup' | 'ok';
  /** The ×'s name when the banner can wait (a friend's challenge): it folds into the badge. */
  readonly later?: string;
  /** The share of its time left (1 to 0), for the bar; none for news. */
  readonly left?: number;
}

/** The ×'s name on a friend's challenge: it folds into the Friends tab's badge, where it waits. */
export const LATER_NAME = 'Later: keep it in Friends';

/** A friend's live challenge, with `left` (1 to 0) of the banner's own time to wait. */
export function challengeIncoming(invite: Invite, left: number): Incoming {
  return {
    who: invite.from,
    title: challengesYou(invite.from),
    line: `${challengeLine(invite)} · live`,
    answers: 'answer',
    later: LATER_NAME,
    left,
  };
}

/** The sender stopped waiting (cancelled, or their lobby went stale) while the banner showed. */
export function stoppedIncoming(from: string): Incoming {
  return {
    who: from,
    title: `${from} stopped waiting`,
    line: 'Challenge them back from Friends',
    answers: 'ok',
  };
}

/**
 * A rematch away from the end screen: asked (Accept and No thanks, the server's 30 s on the bar),
 * agreed (Choose lineup, the lineups' time), or ended (why, with OK). `rules` is the match's
 * ("Best of 3 · Reveal"). Undefined for a rematch that started (the page moves into it).
 */
export function rematchIncoming(
  notice: RematchNotice,
  they: string,
  rules: string,
): Incoming | undefined {
  if (notice.kind === 'asked') {
    return {
      who: they,
      title: `${they} wants a rematch`,
      line: `${rules} · ${String(notice.clock.seconds)} s`,
      answers: 'answer',
      left: notice.clock.left,
    };
  }
  if (notice.kind === 'agreed') {
    return {
      who: they,
      title: notice.clock.title,
      line: `Choose your lineup · ${String(notice.clock.seconds)} s`,
      answers: 'lineup',
      left: notice.clock.left,
    };
  }
  if (notice.kind === 'ended') return { who: they, title: notice.line, line: rules, answers: 'ok' };
  return undefined;
}

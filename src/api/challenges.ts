// Friend challenges (ADR 0052, "Friend challenges"): a link, accepted once, in any format and
// length. The challenger's lineup is never sent to anyone before the series starts.
import type { BestOf, Format } from '../sim/index.ts';

/** POST /api/v1/challenges. */
export interface CreateChallenge {
  readonly format: Format;
  readonly bestOf: BestOf;
  /** The sender's lineup: a series by turns'. A live challenge is sent without one (ADR 0080). */
  readonly lineup?: readonly string[];
  /** The client's id for this create (a UUID), so a retry returns the same link. */
  readonly requestId: string;
  /**
   * Played live (ADR 0053): both players in the match until it ends, Reveal or Showdown only.
   * Without it, the series is played by turns (kept in the code, hidden from players).
   */
  readonly live: boolean;
  /**
   * The accepted friend it is for (a friendship's id, ADR 0079 PR (d)): it reaches their inbox
   * while the lobby waits (by turns, until it is accepted or expires: only where the playtest
   * switch is on, ADR 0085). The link still works for anyone.
   */
  readonly friend?: string;
}

export interface ChallengeLink {
  /** 128 random-looking bits, base64url: the `?challenge=` of the link. */
  readonly token: string;
  readonly format: Format;
  readonly bestOf: BestOf;
  /** ISO 8601: links last 7 days. */
  readonly expiresAt: string;
  /**
   * Sent to a friend whose own lobby waited for the sender (crossed, ADR 0086): theirs was
   * accepted instead, and both pick their lineups here (`token` is their link).
   */
  readonly startId?: string;
}

/** GET /api/v1/challenges/:token: what a friend sees before building a lineup. */
export interface ChallengeInfo {
  readonly format: Format;
  readonly bestOf: BestOf;
  /** The challenger's name; null when they have been deleted. */
  readonly from: string | null;
  /**
   * `open`: can be accepted. `yours`: the viewer sent it. `taken`: someone else accepted it.
   * `accepted`: the viewer accepted it (`seriesId` says where). `expired`. `stopped`: a live link
   * whose sender cancelled it or left the lobby.
   */
  readonly status: 'open' | 'yours' | 'taken' | 'accepted' | 'expired' | 'stopped';
  readonly seriesId: string | null;
  /** The lineups being picked together once a live link is accepted (ADR 0080), as `seriesId`. */
  readonly startId: string | null;
  /** Played live (ADR 0053). */
  readonly live: boolean;
  /** The viewer sent it (a stopped link reads differently to its sender). */
  readonly own: boolean;
  /** To its sender: the friend it was sent to (ADR 0079 PR (d)), else null. */
  readonly invitee: string | null;
  /** To its sender: that friend said No thanks (a live one stopped there). */
  readonly declined: boolean;
  /**
   * To its sender: a newer challenge of theirs called this one off (one outgoing at a time, ADR
   * 0089 addendum of 2026-11-27). Absent from a server before it.
   */
  readonly superseded?: boolean;
  /**
   * To a viewer who blocked its sender (ADR 0086): that pair's id, for Unblock; else null. The
   * sender is never told.
   */
  readonly blocked: string | null;
}

/**
 * POST /api/v1/challenges/:token/accept: nothing for a live link (ADR 0080), the lineup for one by
 * turns.
 */
export interface AcceptChallenge {
  readonly lineup?: readonly string[];
}

/** A live link accepted: its start (the lineups picked together); by turns, its series. */
export interface Accepted {
  readonly seriesId: string | null;
  readonly startId: string | null;
}

const FORMATS: readonly Format[] = ['blind', 'reveal', 'showdown'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BALL = /^[a-z][a-z0-9-]{0,31}$/;

export const lineupOf = (value: unknown): string[] | undefined =>
  Array.isArray(value) &&
  value.length <= 5 &&
  value.every((ball): ball is string => typeof ball === 'string' && BALL.test(ball))
    ? [...value]
    : undefined;

export function decodeCreateChallenge(body: unknown): CreateChallenge | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const { format, bestOf, lineup, requestId, live, friend } = body as Record<string, unknown>;
  const named = FORMATS.find((name) => name === format);
  const length = bestOf === 3 || bestOf === 5 ? bestOf : undefined;
  const balls = lineup === undefined ? undefined : lineupOf(lineup);
  if (named === undefined || length === undefined) return undefined;
  if (lineup !== undefined && balls === undefined) return undefined;
  if (typeof requestId !== 'string' || !UUID.test(requestId)) return undefined;
  if (live !== undefined && typeof live !== 'boolean') return undefined;
  if (friend !== undefined && (typeof friend !== 'string' || !UUID.test(friend))) return undefined;
  return {
    format: named,
    bestOf: length,
    ...(balls === undefined ? {} : { lineup: balls }),
    requestId,
    live: live === true,
    ...(friend === undefined ? {} : { friend }),
  };
}

export function decodeAcceptChallenge(body: unknown): AcceptChallenge | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const lineup = (body as Record<string, unknown>)['lineup'];
  if (lineup === undefined) return {};
  const balls = lineupOf(lineup);
  return balls === undefined ? undefined : { lineup: balls };
}

/** A link's token as it may appear in a URL: 22 base64url characters (16 bytes). */
export const isChallengeToken = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{22}$/.test(value);

// Friend challenges (ADR 0052, "Friend challenges"): a link, accepted once, in any format and
// length. The challenger's lineup is never sent to anyone before the series starts.
import type { BestOf, Format } from '../sim/index.ts';

/** POST /api/v1/challenges. */
export interface CreateChallenge {
  readonly format: Format;
  readonly bestOf: BestOf;
  readonly lineup: readonly string[];
  /** The client's id for this create (a UUID), so a retry returns the same link. */
  readonly requestId: string;
}

export interface ChallengeLink {
  /** 128 random-looking bits, base64url: the `?challenge=` of the link. */
  readonly token: string;
  readonly format: Format;
  readonly bestOf: BestOf;
  /** ISO 8601: links last 7 days. */
  readonly expiresAt: string;
}

/** GET /api/v1/challenges/:token: what a friend sees before building a lineup. */
export interface ChallengeInfo {
  readonly format: Format;
  readonly bestOf: BestOf;
  /** The challenger's name; null when they have been deleted. */
  readonly from: string | null;
  /**
   * `open`: can be accepted. `yours`: the viewer sent it. `taken`: someone else accepted it.
   * `accepted`: the viewer accepted it (`seriesId` says where). `expired`.
   */
  readonly status: 'open' | 'yours' | 'taken' | 'accepted' | 'expired';
  readonly seriesId: string | null;
}

/** POST /api/v1/challenges/:token/accept. */
export interface AcceptChallenge {
  readonly lineup: readonly string[];
}

export interface Accepted {
  readonly seriesId: string;
}

const FORMATS: readonly Format[] = ['blind', 'reveal', 'showdown'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BALL = /^[a-z][a-z0-9-]{0,31}$/;

const lineupOf = (value: unknown): string[] | undefined =>
  Array.isArray(value) &&
  value.length <= 5 &&
  value.every((ball): ball is string => typeof ball === 'string' && BALL.test(ball))
    ? [...value]
    : undefined;

export function decodeCreateChallenge(body: unknown): CreateChallenge | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const { format, bestOf, lineup, requestId } = body as Record<string, unknown>;
  const named = FORMATS.find((name) => name === format);
  const length = bestOf === 3 || bestOf === 5 ? bestOf : undefined;
  const balls = lineupOf(lineup);
  if (named === undefined || length === undefined || balls === undefined) return undefined;
  if (typeof requestId !== 'string' || !UUID.test(requestId)) return undefined;
  return { format: named, bestOf: length, lineup: balls, requestId };
}

export function decodeAcceptChallenge(body: unknown): AcceptChallenge | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const balls = lineupOf((body as Record<string, unknown>)['lineup']);
  return balls === undefined ? undefined : { lineup: balls };
}

/** A link's token as it may appear in a URL: 22 base64url characters (16 bytes). */
export const isChallengeToken = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{22}$/.test(value);

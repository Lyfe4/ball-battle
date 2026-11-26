// What Profile says of an account's record (ADR 0088): the stats card's three facts, the empty
// state before the first online match, and each Recent matches row in short and in words. Pure, so
// every state is tested without a DOM.
import type { RecentSeries, RecordResponse } from '../api/record.ts';

export const RECORD_TITLE = 'Your record';
export const RECENT_TITLE = 'Recent matches';
export const RECORD_FAILED_TITLE = 'Your record';
/** Before the first online match: what will show here, and how it starts. */
export const RECORD_EMPTY =
  'Your wins, matches and favourite ball show here after your first online match with a friend.';
/** A player who has since deleted their account, as home's series list names them. */
export const DELETED_PLAYER = 'Deleted player';

export interface StatFact {
  /** The number or the ball's name, big. */
  readonly value: string;
  readonly label: string;
  /** The favourite ball's id, for its picture. */
  readonly ball?: string;
}

/** The stats card's facts: wins, played, and the favourite ball (named by `nameOf`). */
export function statFacts(
  record: RecordResponse,
  nameOf: (ball: string) => string | undefined,
): readonly StatFact[] {
  const facts: StatFact[] = [
    { value: String(record.wins), label: record.wins === 1 ? 'Win' : 'Wins' },
    { value: String(record.played), label: 'Played' },
  ];
  const name = record.favourite === null ? undefined : nameOf(record.favourite);
  if (record.favourite !== null && name !== undefined) {
    facts.push({ value: name, label: 'Favourite', ball: record.favourite });
  }
  return facts;
}

/** "26 Nov", with the year when it isn't this one ("3 Dec 2025"). */
export function shortDate(iso: string, now: Date, locale?: string): string {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date);
}

export interface RecentRow {
  readonly name: string;
  /** "Won 2–1" or "Lost 0–2"; a forfeit says so: "Won · they left". */
  readonly result: string;
  readonly won: boolean;
  /** "26 Nov · Live", "26 Nov · By turns". */
  readonly when: string;
  /** The whole row for a screen reader. */
  readonly label: string;
}

export function recentRow(series: RecentSeries, now: Date, locale?: string): RecentRow {
  const name = series.opponent ?? DELETED_PLAYER;
  const score = `${String(series.score.you)}–${String(series.score.them)}`;
  const outcome = series.won ? 'Won' : 'Lost';
  const result = series.forfeit ? `${outcome} ${score} · forfeit` : `${outcome} ${score}`;
  const how = series.live ? 'Live' : 'By turns';
  const date = shortDate(series.finishedAt, now, locale);
  const label = `${outcome} against ${name}, ${String(series.score.you)} to ${String(series.score.them)}${
    series.forfeit ? ', by forfeit' : ''
  }, ${how.toLowerCase()}, ${date}`;
  return { name, result, won: series.won, when: `${date} · ${how}`, label };
}

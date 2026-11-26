// What Profile says of an account's record (ADR 0088, 0089): the record card's three facts, the
// empty state before the first online match, "Your stats", each match row in short and in words,
// and All matches' lines. Pure, so every state is tested without a DOM.
import type { Ending, RecentSeries, RecordResponse, Tally } from '../api/record.ts';

export const RECORD_TITLE = 'Your record';
export const RECORD_MORE = 'More stats';
export const RECENT_TITLE = 'Last matches';
export const ALL_MATCHES = 'All matches';
export const STATS_TITLE = 'Your stats';
export const RECORD_FAILED_TITLE = 'Your record';
export const MATCHES_FAILED_TITLE = 'More matches';
/** Before the first online match: what will show here, and how it starts. */
export const RECORD_EMPTY =
  'Finish a match against a friend and it counts here. Bot games stay on this device.';
/** Under Your stats: what counts. */
export const STATS_NOTE = 'Online matches with friends only. Bot games stay on this device.';
/** A player who has since deleted their account, as home's series list names them. */
export const DELETED_PLAYER = 'Deleted player';
/** How many matches Profile lists on a phone (more beside them on a desktop, profile-record.css). */
export const RECENT_ON_PHONE = 3;
/** How many on a desktop, where the main column has the room above the fold. */
export const RECENT_ON_DESKTOP = 8;

/** How a forfeit ended, in words that say whose (ADR 0089, the owner's words). */
export const ENDING_WORDS: Readonly<Record<Ending, string>> = {
  youLeft: 'You left',
  theyLeft: 'They left',
  yourTime: 'Your time ran out',
  theirTime: 'Their time ran out',
};

export interface StatFact {
  /** The number or the ball's name, big. */
  readonly value: string;
  readonly label: string;
  /** The favourite ball's id, for its picture. */
  readonly ball?: string;
}

/** The record card's facts: wins, played, and the favourite ball (named by `nameOf`). */
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

/** The record card as a button, in words: "Your record: 31 wins of 54 played. More stats". */
export function recordLabel(record: RecordResponse): string {
  return `${RECORD_TITLE}: ${String(record.wins)} ${record.wins === 1 ? 'win' : 'wins'} of ${String(
    record.played,
  )} played. ${RECORD_MORE}`;
}

/** "22 won · 14 lost", or "None yet". */
function tallyText({ wins, played }: Tally): string {
  return played === 0 ? 'None yet' : `${String(wins)} won · ${String(played - wins)} lost`;
}

/** "Your stats", a row each (ADR 0089): the win rate, the four breakdowns, the streak, the ball. */
export function statRows(
  record: RecordResponse,
  nameOf: (ball: string) => string | undefined,
): readonly StatFact[] {
  const { stats } = record;
  const rate = record.played === 0 ? 0 : Math.round((100 * record.wins) / record.played);
  const rows: StatFact[] = [
    { label: 'Win rate', value: `${String(rate)}%` },
    { label: 'Live', value: tallyText(stats.live) },
    { label: 'By turns', value: tallyText(stats.turns) },
    { label: 'Best of 3', value: tallyText(stats.bestOf3) },
    { label: 'Best of 5', value: tallyText(stats.bestOf5) },
    {
      label: 'Best streak',
      value: `${String(stats.bestStreak)} ${stats.bestStreak === 1 ? 'win' : 'wins'}`,
    },
  ];
  const name = record.favourite === null ? undefined : nameOf(record.favourite);
  if (record.favourite !== null && name !== undefined) {
    rows.push({
      label: 'Most played',
      value: `${name} · ${String(stats.favouriteIn)}`,
      ball: record.favourite,
    });
  }
  return rows;
}

/** All matches' line under its title: "54 matches · online with friends". */
export function matchesLine(played: number): string {
  return `${String(played)} ${played === 1 ? 'match' : 'matches'} · online with friends`;
}

/** The quiet line after the last match. */
export function endLine(played: number): string {
  return played === 1 ? 'That’s your only match.' : `That’s all ${String(played)}.`;
}

const DAY_MS = 86_400_000;

/** "Today", "Yesterday", "24 Nov", with the year when it isn't this one ("3 Dec 2025"). */
export function shortDate(iso: string, now: Date, locale?: string): string {
  const date = new Date(iso);
  const midnight = (day: Date) => new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const days = Math.round((midnight(now).getTime() - midnight(date).getTime()) / DAY_MS);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date);
}

export interface MatchRow {
  readonly name: string;
  /** "Won" or "Lost": a word on its tag, never colour alone. */
  readonly result: 'Won' | 'Lost';
  readonly won: boolean;
  /** The score in rounds ("2–1"), or whose forfeit it was ("They left"). */
  readonly detail: string;
  /** "Today", "24 Nov". */
  readonly date: string;
  /** "Live" or "By turns". */
  readonly how: string;
  /** The whole row for a screen reader. */
  readonly label: string;
}

export function matchRow(series: RecentSeries, now: Date, locale?: string): MatchRow {
  const name = series.opponent ?? DELETED_PLAYER;
  const result = series.won ? 'Won' : 'Lost';
  const ending = series.ending === null ? undefined : ENDING_WORDS[series.ending];
  const detail = ending ?? `${String(series.score.you)}–${String(series.score.them)}`;
  const how = series.live ? 'Live' : 'By turns';
  const date = shortDate(series.finishedAt, now, locale);
  const spoken = ending ?? `${String(series.score.you)} to ${String(series.score.them)}`;
  const label = `${result} against ${name}, ${spoken}, ${date}, ${how.toLowerCase()}`;
  return { name, result, won: series.won, detail, date, how, label };
}

// The client's reading of a SeriesView (ADR 0052): a total decoder, like decodeSeriesSetup, so a
// malformed or unexpected answer is refused in one place rather than breaking a screen later.
// The final setup is checked by verifySeries itself, so here it is only an object or null.
import type { PickRecord, RoundRecord, SeriesSetup, Side } from '../sim/index.ts';
import type { LiveEndReason, LiveView } from './live.ts';
import type {
  SeedCommitment,
  SeedPurpose,
  SeedReveal,
  SeriesStatus,
  SeriesView,
  Turn,
} from './series.ts';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isSide = (value: unknown): value is Side => value === 'a' || value === 'b';
const isInt = (value: unknown, low: number, high: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= low && value <= high;
const isBall = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(value);
const isHex = (value: unknown, bytes: number): value is string =>
  typeof value === 'string' && new RegExp(`^[0-9a-f]{${String(2 * bytes)}}$`).test(value);
const PURPOSES: readonly SeedPurpose[] = ['round', 'toss', 'lineup', 'bot'];
const STATUSES: readonly SeriesStatus[] = ['open', 'finished', 'forfeit', 'void'];

function listOf<T>(value: unknown, item: (entry: unknown) => T | undefined): T[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items: T[] = [];
  for (const entry of value as readonly unknown[]) {
    const decoded = item(entry);
    if (decoded === undefined) return undefined;
    items.push(decoded);
  }
  return items;
}

const lineupOf = (value: unknown) =>
  value === null ? null : listOf(value, (b) => (isBall(b) ? b : undefined));

function pickOf(value: unknown): PickRecord | undefined {
  if (!isRecord(value)) return undefined;
  const { round, side, ball } = value;
  return isInt(round, 0, 4) && isSide(side) && isBall(ball) ? { round, side, ball } : undefined;
}

function roundOf(value: unknown): RoundRecord | undefined {
  if (!isRecord(value)) return undefined;
  const { round, a, b, seeds, outcomes, winner, suddenDeath } = value;
  const seedList = listOf(seeds, (s) => (isInt(s, 0, 0xffff_ffff) ? s : undefined));
  const outcomeList = listOf(outcomes, (o) => (isSide(o) || o === 'draw' ? o : undefined));
  if (!isInt(round, 0, 4) || !isBall(a) || !isBall(b) || !isSide(winner)) return undefined;
  if (seedList === undefined || outcomeList === undefined || typeof suddenDeath !== 'boolean') {
    return undefined;
  }
  return { round, a, b, seeds: seedList, outcomes: outcomeList, winner, suddenDeath };
}

function commitmentOf(value: unknown): SeedCommitment | undefined {
  if (!isRecord(value)) return undefined;
  const { purpose, index, commitment } = value;
  const named = PURPOSES.find((p) => p === purpose);
  return named !== undefined && isInt(index, 0, 4) && isHex(commitment, 32)
    ? { purpose: named, index, commitment }
    : undefined;
}

function revealOf(value: unknown): SeedReveal | undefined {
  const committed = commitmentOf(value);
  if (committed === undefined || !isRecord(value)) return undefined;
  const { seed, salt } = value;
  return isInt(seed, 0, 0xffff_ffff) && isHex(salt, 16) ? { ...committed, seed, salt } : undefined;
}

const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;
const timeOrNull = (value: unknown): number | null | undefined =>
  value === null ? null : isTime(value) ? value : undefined;
const END_REASONS: readonly LiveEndReason[] = ['timeout', 'left', 'disconnected', 'start_missed'];

/** A live series' clock: null for a series by turns, undefined when malformed. */
function liveOf(value: unknown): LiveView | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const { startBy, away, endReason } = value;
  const startedAt = timeOrNull(value['startedAt']);
  const opensAt = timeOrNull(value['opensAt']);
  const fights = listOf(value['fights'], (f) =>
    isRecord(f) && isInt(f['round'], 0, 4) && isTime(f['fightAt']) && isTime(f['endsAt'])
      ? { round: f['round'], fightAt: f['fightAt'], endsAt: f['endsAt'] }
      : undefined,
  );
  const auto = listOf(value['auto'], (p) =>
    isRecord(p) && isInt(p['round'], 0, 4) && isSide(p['side'])
      ? { round: p['round'], side: p['side'] }
      : undefined,
  );
  const gone =
    away === null
      ? null
      : isRecord(away) && isTime(away['since']) && isTime(away['forfeitAt'])
        ? { since: away['since'], forfeitAt: away['forfeitAt'] }
        : undefined;
  const reason = endReason === null ? null : END_REASONS.find((r) => r === endReason);
  if (
    startedAt === undefined ||
    opensAt === undefined ||
    !isTime(startBy) ||
    fights === undefined ||
    auto === undefined ||
    gone === undefined ||
    reason === undefined
  ) {
    return undefined;
  }
  return { startedAt, startBy, opensAt, fights, auto, away: gone, endReason: reason };
}

const nameOf = (value: unknown): string | null | undefined =>
  value === null ? null : typeof value === 'string' && value.length <= 40 ? value : undefined;

/** The series view in `raw`, if it is one; anything else is undefined. */
export function decodeSeriesView(raw: unknown): SeriesView | undefined {
  if (!isRecord(raw)) return undefined;
  const { id, ruleset, format, bestOf, you, names, lineups, turn, deadline, status, winner } = raw;
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id) || !isInt(ruleset, 1, 0xffff_ffff)) {
    return undefined;
  }
  if (format !== 'blind' && format !== 'reveal' && format !== 'showdown') return undefined;
  if ((bestOf !== 3 && bestOf !== 5) || !isSide(you) || !isRecord(names) || !isRecord(lineups)) {
    return undefined;
  }
  const nameA = nameOf(names['a']);
  const nameB = nameOf(names['b']);
  const lineupA = lineupOf(lineups['a']);
  const lineupB = lineupOf(lineups['b']);
  const picks = listOf(raw['picks'], pickOf);
  const rounds = listOf(raw['rounds'], roundOf);
  const commitments = listOf(raw['commitments'], commitmentOf);
  const revealed = listOf(raw['revealed'], revealOf);
  const named = STATUSES.find((s) => s === status);
  const turnOk: Turn | null | undefined =
    turn === null ? null : isSide(turn) || turn === 'both' ? turn : undefined;
  const final = raw['final'];
  const live = liveOf(raw['live'] ?? null);
  if (
    live === undefined ||
    nameA === undefined ||
    nameB === undefined ||
    lineupA === undefined ||
    lineupB === undefined ||
    picks === undefined ||
    rounds === undefined ||
    commitments === undefined ||
    revealed === undefined ||
    named === undefined ||
    turnOk === undefined ||
    (deadline !== null && (typeof deadline !== 'string' || Number.isNaN(Date.parse(deadline)))) ||
    (winner !== null && !isSide(winner)) ||
    !isInt(raw['version'], 0, 0x7fff_ffff) ||
    (final !== null && !isRecord(final))
  ) {
    return undefined;
  }
  return {
    id,
    kind: 'friend',
    ruleset,
    format,
    bestOf,
    you,
    names: { a: nameA, b: nameB },
    lineups: { a: lineupA, b: lineupB },
    picks,
    rounds,
    commitments,
    revealed,
    turn: turnOk,
    deadline,
    status: named,
    winner,
    version: raw['version'],
    final: final as SeriesSetup | null,
    live,
  };
}

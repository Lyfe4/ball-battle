// Two players and a series between them, for the database tests: guests made through the real
// route, a series made by the service, picks locked through the real route.
import type { SeriesView } from '../../api/series.ts';
import type { BestOf, Format, Side } from '../../sim/index.ts';
import type { Deps } from '../http.ts';
import { seriesOne } from '../routes/series.ts';
import { session } from '../routes/session.ts';
import { createSeries } from '../series-service.ts';
import { TestBrowser, type Answer } from './client.ts';

export interface Player {
  readonly browser: TestBrowser;
  readonly userId: string;
}

/** A new guest on its own device and IP. */
export async function newPlayer(deps: Deps): Promise<Player> {
  const browser = new TestBrowser(deps);
  const answer = await browser.call(session, 'POST', '/api/v1/session', { adult: true });
  if (answer.status !== 201 || browser.cookie === undefined) throw new Error('No guest');
  return { browser, userId: userIdOf(browser.cookie) };
}

/** The user id in a session cookie's access token (the test reads its own cookie). */
export function userIdOf(cookie: string): string {
  const { a } = JSON.parse(Buffer.from(cookie, 'base64url').toString('utf8')) as { a: string };
  const payload = JSON.parse(Buffer.from(a.split('.')[1] ?? '', 'base64url').toString('utf8')) as {
    sub: string;
  };
  return payload.sub;
}

export const LINEUP_3: Readonly<Record<Side, readonly string[]>> = {
  a: ['archer', 'thorns', 'vampire'],
  b: ['brawler', 'magnet', 'frost'],
};
export const LINEUP_5: Readonly<Record<Side, readonly string[]>> = {
  a: ['archer', 'thorns', 'vampire', 'storm', 'venom'],
  b: ['brawler', 'magnet', 'frost', 'quake', 'sniper'],
};

export async function newSeries(
  deps: Deps,
  players: Readonly<Record<Side, Player>>,
  format: Format,
  bestOf: BestOf = 3,
): Promise<string> {
  return deps.sql.begin((db) =>
    createSeries(db, deps.config, {
      format,
      bestOf,
      players: { a: players.a.userId, b: players.b.userId },
      lineups: bestOf === 3 ? LINEUP_3 : LINEUP_5,
    }),
  );
}

export const view = (answer: Answer): SeriesView => {
  if (answer.status !== 200) throw new Error(`Expected 200, got ${String(answer.status)}`);
  return answer.body as SeriesView;
};

export const read = async (player: Player, id: string): Promise<SeriesView> =>
  view(await player.browser.call(seriesOne, 'GET', `/api/v1/series/${id}`));

export const pick = (player: Player, id: string, round: number, ball: string): Promise<Answer> =>
  player.browser.call(seriesOne, 'POST', `/api/v1/series/${id}/picks`, { round, ball });

/** The balls a side has not played yet, as its own view shows them. */
export function leftOf(seen: SeriesView, side: Side): string[] {
  const played = new Set(seen.rounds.map((round) => round[side]));
  return (seen.lineups[side] ?? []).filter((ball) => !played.has(ball));
}

/** The sides whose turn it is. */
export const dueSides = (seen: SeriesView): Side[] =>
  seen.turn === null ? [] : seen.turn === 'both' ? ['a', 'b'] : [seen.turn];

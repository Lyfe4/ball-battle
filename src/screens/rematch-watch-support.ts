// The fake server and host the rematch watch's browser tests share (rematch-watch.ts): the ended
// live match as a side sees it, the server's rematch answers, and a host that records moves,
// storage and home's way back.
import { vi } from 'vitest';
import type { RematchView } from '../api/rematch.ts';
import type { SeriesView } from '../api/series.ts';
import type { RematchWatchHost } from './rematch-watch.ts';

export const ID = '11111111-2222-4333-8444-555555555555';
export const T = 1_800_000_000_000;

/** The ended live match, as side `you` sees it (only what the watch reads): a forfeit. */
export const ended = (you: 'a' | 'b') =>
  ({
    id: ID,
    you,
    names: { a: 'Player 4195', b: 'Player 6282' },
    format: 'reveal',
    bestOf: 3,
    status: 'forfeit',
    live: { startedAt: T - 9_000, fights: [] },
  }) as unknown as SeriesView;

/**
 * A live match played out: the server calls it finished at its last pick, while the last fight
 * still plays until `endsAt` (server time), and a rematch can be asked only from then.
 */
export const played = (you: 'a' | 'b', endsAt: number) =>
  ({
    ...ended(you),
    status: 'finished',
    live: { startedAt: T - 90_000, fights: [{ round: 3, fightAt: endsAt - 40_000, endsAt }] },
  }) as unknown as SeriesView;

/** The lineups picked together once both said yes (ADR 0080). */
export const START = '22222222-3333-4444-8555-666666666666';

export const view = (over: Partial<RematchView>): RematchView => ({
  state: 'none',
  askedBy: null,
  declinedBy: null,
  deadline: null,
  now: T,
  startId: over.state === 'agreed' || over.state === 'started' ? START : null,
  lineupIn: false,
  seriesId: null,
  offered: true,
  ...over,
});

/** The fake server: what GET answers now, every request it was sent, and its answer to a POST. */
export function server(answer: RematchView) {
  const sent: { method: string; body: unknown }[] = [];
  const state = { answer, onPost: (): RematchView => answer };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    const raw = init?.body;
    const body: unknown = typeof raw === 'string' ? JSON.parse(raw) : undefined;
    sent.push({ method: init?.method ?? 'GET', body });
    if (init?.method === 'POST') state.answer = state.onPost();
    await new Promise((done) => setTimeout(done, 5));
    return new Response(JSON.stringify(state.answer), { status: 200 });
  });
  return { sent, state };
}

export function host(over: Partial<RematchWatchHost> = {}) {
  const moves: string[] = [];
  const memory = new Map<string, string>();
  const storage = () => ({
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => void memory.set(key, value),
    removeItem: (key: string) => void memory.delete(key),
    key: () => null,
    length: 0,
  });
  let fighting = false;
  const backs: (string | undefined)[] = [];
  const made: RematchWatchHost = {
    storage,
    go: (write) => {
      const url = new URLSearchParams();
      write(url);
      moves.push(url.toString());
    },
    fighting: () => fighting,
    ownScreen: () => undefined,
    seriesShown: () => undefined,
    backChanged: (back) => {
      if (backs.at(-1) !== back?.kind) backs.push(back?.kind);
    },
    ...over,
  };
  return {
    made,
    moves,
    memory,
    backs,
    fight: (on: boolean) => {
      fighting = on;
    },
  };
}

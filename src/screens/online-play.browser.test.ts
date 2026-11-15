// A live fight on the page does nothing on each read of the series (ADR 0053): while it plays, a
// poll is the heartbeat and nothing else. No redraw of the arena or the page's layout (the arena's
// own frames draw it), no fight put on the arena again, and a better clock estimate never nudges a
// fight already under way. Both roles' pages are this one screen: the sender's (side A) and the
// friend's (side B), each checked.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attemptWatchMs, NOW_HEADER } from '../api/live.ts';
import type { SeriesView } from '../api/series.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import type { SeriesSetup, Side } from '../sim/series.ts';
import { matchWorld, playSeries, playToEnd } from '../sim/series-verify.ts';
import { createOnlinePlay } from './online-play.ts';

const ID = '11111111-2222-4333-8444-555555555555';
const FIGHT_AT = 1_800_000_000_000;
const SETUP: SeriesSetup = {
  ruleset: RULESET_VERSION,
  seed: 0,
  a: ['archer', 'thorns', 'vampire'],
  b: ['brawler', 'magnet', 'frost'],
  opponent: { kind: 'player' },
  seeds: { rounds: [101, 202, 303] },
};

/** Round 1 of a live series, its fight scheduled at FIGHT_AT, as side `you` is sent it. */
function liveView(you: Side): SeriesView {
  const record = playSeries(SETUP, BALL_LOOKUP).rounds[0];
  if (record === undefined) throw new Error('No round');
  const ticks = record.seeds.map(
    (seed, attempt) =>
      playToEnd(
        matchWorld({ round: 0, attempt, seed, a: record.a, b: record.b }, BALL_LOOKUP),
        BALL_LOOKUP,
      ).tick,
  );
  const endsAt = ticks.reduce((at, length) => at + attemptWatchMs(length), FIGHT_AT);
  return {
    id: ID,
    kind: 'friend',
    ruleset: RULESET_VERSION,
    format: 'blind',
    bestOf: 3,
    you,
    names: { a: 'Player 4195', b: 'Player 6282' },
    lineups: { a: SETUP.a, b: SETUP.b },
    picks: [],
    rounds: [record],
    commitments: [{ purpose: 'round', index: 0, commitment: '0'.repeat(64) }],
    revealed: [
      { purpose: 'round', index: 0, commitment: '0'.repeat(64), seed: 101, salt: '0f'.repeat(16) },
    ],
    turn: null,
    deadline: null,
    status: 'open',
    winner: null,
    version: 4,
    final: null,
    live: {
      startedAt: FIGHT_AT - 40_000,
      startBy: FIGHT_AT,
      opensAt: null,
      fights: [{ round: 0, fightAt: FIGHT_AT, endsAt }],
      auto: [],
      away: null,
      endReason: null,
    },
  };
}

/** The page's host, counting what each read makes it do. */
function countingHost() {
  let worlds = 0;
  const calls = { layout: 0, redraw: 0, staged: 0 };
  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => void memory.set(key, value),
    removeItem: (key: string) => void memory.delete(key),
    key: () => null,
    length: 0,
  };
  const staged = () => {
    worlds += 1;
    calls.staged += 1;
  };
  return {
    calls,
    host: {
      showWorld: staged,
      holdLive: staged,
      showLiveAt: staged,
      release: () => undefined,
      countdown: () => undefined,
      worldsShown: () => worlds,
      layoutChanged: () => void (calls.layout += 1),
      redraw: () => void (calls.redraw += 1),
      home: () => undefined,
      storage: () => storage,
    },
  };
}

/**
 * The server: the series in full, then a 304 to every read that sends its ETag back; `offset` is
 * how far the server's clock is from this page's (its answers say so in X-Now).
 */
interface Answers {
  offset: number;
  /** Each answer's round trip. */
  trip: number;
  /** Every answer in full, never a 304. */
  full: boolean;
  /** Every answer a new version (as when the opponent shows as away and back). */
  bump?: boolean;
}

function server(view: SeriesView, answer: Answers) {
  let version = view.version;
  const fetch = vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise<Response>((resolve) => {
        const sent = new Headers(init.headers).get('If-None-Match');
        if (answer.bump === true) version += 1;
        const body = { ...view, version };
        const at = Date.now() + answer.trip / 2 + answer.offset;
        const headers = { ETag: '"v4"', [NOW_HEADER]: String(at) };
        setTimeout(() => {
          resolve(
            sent === '"v4"' && !answer.full
              ? new Response(null, { status: 304, headers })
              : Response.json(body, { headers }),
          );
        }, answer.trip);
      }),
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

/** A real task: reading a response's body waits on one, which fake timers don't run. */
const task = () =>
  new Promise<void>((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      resolve();
    };
    channel.port2.postMessage(0);
  });

/** Moves the clock on by `ms` in small steps, letting answers land as they come. */
async function pass(ms: number): Promise<void> {
  for (let left = ms; left > 0; left -= 50) {
    await vi.advanceTimersByTimeAsync(Math.min(50, left));
    await task();
    await task();
  }
}

function roots() {
  const make = () => document.body.appendChild(document.createElement('section'));
  return { panel: make(), exit: make(), notice: make(), loading: make() };
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe.each([
  ['the sender', 'a'],
  ['the friend', 'b'],
] as const)('%s’s page, while a live fight plays', (_role, you) => {
  /** Opens the series 2 s into its fight and lets the first answer land. */
  async function openMidFight(answer: Answers) {
    vi.setSystemTime(FIGHT_AT + 2_000);
    const fetch = server(liveView(you), answer);
    const { host, calls } = countingHost();
    createOnlinePlay(roots(), BALL_LOOKUP, host).open(ID);
    // Until the first answer has put the fight on the arena (an engine may need a few more tasks).
    for (let waited = 0; calls.staged === 0 && waited < 3_000; waited += 50) await pass(50);
    expect(calls.staged, 'the fight under way is put on the arena once').toBe(1);
    return { fetch, calls };
  }

  it('reads the series as its heartbeat and does nothing else on each answer', async () => {
    const { fetch, calls } = await openMidFight({ offset: 0, trip: 300, full: false });
    const reads = fetch.mock.calls.length;
    const before = { ...calls };
    await pass(6_000);
    expect(fetch.mock.calls.length - reads, 'about one read a second').toBeGreaterThanOrEqual(4);
    expect(calls).toStrictEqual(before);
  });

  it('does nothing either when an answer is the same series in full', async () => {
    const { calls } = await openMidFight({ offset: 0, trip: 300, full: true });
    const before = { ...calls };
    await pass(6_000);
    expect(calls).toStrictEqual(before);
  });

  it('never nudges the fight when a better clock estimate arrives', async () => {
    const answer = { offset: 0, trip: 600, full: true, bump: false };
    const { calls } = await openMidFight(answer);
    // Quicker answers from a clock 0.4 s ahead: the page's estimate moves by 0.4 s.
    answer.offset = 400;
    answer.trip = 100;
    answer.bump = true;
    await pass(3_000);
    expect(calls.staged).toBe(1);
  });
});

describe('arriving at a live series (ADR 0054)', () => {
  it('shows a series read just before moving at once, with no read of its own first', async () => {
    vi.setSystemTime(FIGHT_AT - 4_000);
    const view = liveView('b');
    const fetch = server(view, { offset: 0, trip: 300, full: false });
    const { host, calls } = countingHost();
    const at = Date.now();
    const primed = {
      ok: true as const,
      status: 200,
      body: view,
      etag: '"v4"',
      clock: { sentAt: at - 300, receivedAt: at, serverNow: at - 150 },
    };
    const parts = roots();
    createOnlinePlay(parts, BALL_LOOKUP, { ...host, primed: () => primed }).open(ID);
    expect(calls.staged, 'the round is on the arena as the screen opens').toBe(1);
    expect(parts.loading.hidden).toBe(true);
    expect(parts.notice.hidden).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    await pass(1_500);
    expect(fetch.mock.calls.length, 'then it asks as a live page does').toBeGreaterThanOrEqual(1);
  });

  it('opened cold, shows the screen’s layout until the first answer, never a Loading notice', async () => {
    vi.setSystemTime(FIGHT_AT - 4_000);
    server(liveView('a'), { offset: 0, trip: 600, full: false });
    const { host, calls } = countingHost();
    const parts = roots();
    createOnlinePlay(parts, BALL_LOOKUP, host).open(ID);
    expect(parts.loading.hidden).toBe(false);
    expect(parts.loading.getAttribute('aria-busy')).toBe('true');
    expect(parts.notice.hidden).toBe(true);
    const headings = [...document.querySelectorAll('h1')].map((h) => h.textContent);
    expect(headings).not.toContain('Loading…');
    for (let waited = 0; calls.staged === 0 && waited < 3_000; waited += 50) await pass(50);
    expect(calls.staged).toBe(1);
    expect(parts.loading.hidden).toBe(true);
  });
});

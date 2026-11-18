// A rematch reaching a player away from the end screen (rematch-watch.ts, playtest 2026-11-19), in a
// real browser against a fake server: the notice says who asks with the seconds left on any calm
// screen, waits while a fight is on, never shows on that match's own end screen, sends one answer
// however often Accept is tapped, takes both players to the lineup on a yes, tells the one who
// asked of a no (after a reload too), and ends quietly when the time runs out.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../style.css';
import type { RematchView } from '../api/rematch.ts';
import type { SeriesView } from '../api/series.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { createRematchWatch, type RematchWatchHost } from './rematch-watch.ts';

const ID = '11111111-2222-4333-8444-555555555555';
const T = 1_800_000_000_000;

/** The ended live match, as side `you` sees it (only what the watch reads). */
const ended = (you: 'a' | 'b') =>
  ({
    id: ID,
    you,
    names: { a: 'Player 4195', b: 'Player 6282' },
    format: 'reveal',
    bestOf: 3,
    status: 'forfeit',
    live: { startedAt: T - 9_000 },
  }) as unknown as SeriesView;

const view = (over: Partial<RematchView>): RematchView => ({
  state: 'none',
  askedBy: null,
  declinedBy: null,
  deadline: null,
  now: T,
  lineupIn: false,
  seriesId: null,
  offered: true,
  ...over,
});

/** The fake server: what GET answers now, every request it was sent, and its answer to a POST. */
function server(answer: RematchView) {
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

function host(over: Partial<RematchWatchHost> = {}) {
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
  const made: RematchWatchHost = {
    storage,
    go: (write) => {
      const url = new URLSearchParams();
      write(url);
      moves.push(url.toString());
    },
    fighting: () => fighting,
    endScreen: () => undefined,
    ...over,
  };
  return {
    made,
    moves,
    memory,
    fight: (on: boolean) => {
      fighting = on;
    },
  };
}

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));
let root: HTMLElement;
const card = () => ({
  shown: !root.hidden,
  title: root.querySelector('.pick-clock-title-text')?.textContent,
  seconds: root.querySelector('.pick-clock-seconds')?.textContent,
  line: root.querySelector('.rematch-notice-line')?.textContent,
  buttons: [...root.querySelectorAll<HTMLButtonElement>('button')]
    .filter((one) => !one.hidden)
    .map((one) => one.textContent),
});
const button = (name: string) =>
  [...root.querySelectorAll<HTMLButtonElement>('button')].find((one) => one.textContent === name);

beforeEach(() => {
  root = document.createElement('div');
  document.body.replaceChildren(root);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('a rematch asked of a player away from the end screen', () => {
  it('says who asks with the seconds left, and Accept takes them to the lineup with one answer', async () => {
    const fake = server(view({ state: 'asked', askedBy: 'a', deadline: T + 24_000 }));
    fake.state.onPost = () => view({ state: 'agreed', askedBy: 'a', deadline: T + 60_000 });
    const page = host();
    const watch = createRematchWatch(root, BALL_LOOKUP, page.made);
    watch.ended(ended('b'));
    await wait(100);
    expect(card()).toMatchObject({
      shown: true,
      title: 'Player 4195 wants a rematch',
      seconds: '24 s',
      buttons: ['Accept', 'No thanks'],
    });
    // Tapped three times: one answer, and the player goes straight to the new lineup.
    for (let tap = 0; tap < 3; tap += 1) button('Accept')?.click();
    await wait(100);
    expect(fake.sent.filter((one) => one.method === 'POST')).toStrictEqual([
      { method: 'POST', body: { answer: 'yes' } },
    ]);
    expect(page.moves).toStrictEqual([`view=send&fmt=reveal&mode=bo3&rematch=${ID}`]);
    expect(card().shown).toBe(false);
    expect(page.memory.size, 'the watch ends').toBe(0);
  });

  it('waits while a fight is on, and never shows on that match’s own end screen', async () => {
    server(view({ state: 'asked', askedBy: 'a', deadline: T + 24_000 }));
    let endScreen: string | undefined = ID;
    const page = host({ endScreen: () => endScreen });
    const watch = createRematchWatch(root, BALL_LOOKUP, page.made);
    watch.ended(ended('b'));
    await wait(100);
    expect(card().shown, 'the end screen asks for itself').toBe(false);
    endScreen = undefined;
    page.fight(true);
    watch.refresh();
    await wait(100);
    expect(card().shown, 'never over a fight').toBe(false);
    page.fight(false);
    watch.refresh();
    expect(card().shown).toBe(true);
  });

  it('tells the one who asked of a no, after a reload too, until OK', async () => {
    const fake = server(view({ state: 'asked', askedBy: 'a', deadline: T + 24_000 }));
    const page = host();
    createRematchWatch(root, BALL_LOOKUP, page.made).ended(ended('a'));
    await wait(100);
    expect(card().shown, 'the asker waits').toBe(false);
    // The tab closed and opened again: the watch is remembered.
    fake.state.answer = view({ state: 'declined', askedBy: 'a', declinedBy: 'b' });
    root.replaceChildren();
    createRematchWatch(root, BALL_LOOKUP, page.made);
    await wait(100);
    expect(card()).toMatchObject({
      shown: true,
      line: 'Player 6282 said no to a rematch.',
      buttons: ['OK'],
    });
    button('OK')?.click();
    expect(card().shown).toBe(false);
    expect(page.memory.size).toBe(0);
  });

  it('ends quietly for the one asked when the time runs out, and stops asking', async () => {
    const fake = server(view({ state: 'asked', askedBy: 'a', deadline: T + 1_000 }));
    const page = host();
    createRematchWatch(root, BALL_LOOKUP, page.made).ended(ended('b'));
    await wait(100);
    expect(card().seconds).toBe('1 s');
    await wait(1_100);
    expect(card().shown).toBe(false);
    fake.state.answer = view({ state: 'expired', askedBy: 'a', deadline: T + 1_000 });
    await wait(2_200);
    const asked = fake.sent.length;
    expect(card().shown).toBe(false);
    await wait(2_200);
    expect(fake.sent.length, 'nothing more can happen: no more asking').toBe(asked);
    expect(page.memory.size).toBe(0);
  });
});

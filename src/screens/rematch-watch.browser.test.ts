// A rematch reaching a player away from the end screen (rematch-watch.ts, playtest 2026-11-19), in a
// real browser against a fake server: the incoming banner (ADR 0086) says who asks with the seconds left on any calm
// screen, waits while a fight is on, never shows on that match's own screens, sends one answer
// however often Accept is tapped, takes the one who accepts to the lineup, tells the one who asked
// of the yes with the seconds left and Choose lineup (2026-11-23) and of a no (after a reload too),
// tells both of the time running out after a yes, keeps the watch as long as the rematch can move,
// shows home's way back while it waits on the player, and ends quietly when the time runs out.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../style.css';
import { createRematchWatch } from './rematch-watch.ts';
import { ended, host, ID, played, server, START, T, view } from './rematch-watch-support.ts';

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));
/** Waits until `done`, at most `ms`: a named wait, never a fixed one where the page acts on a tick. */
async function within(ms: number, what: string, done: () => boolean): Promise<void> {
  const end = Date.now() + ms;
  while (!done()) {
    if (Date.now() > end) throw new Error(`Not within ${String(ms)} ms: ${what}`);
    await wait(20);
  }
}
let root: HTMLElement;
const card = () => ({
  shown: !root.hidden,
  title: root.querySelector('.incoming-title')?.textContent,
  // The seconds end the banner's second line ("Best of 3 · Reveal · 24 s").
  seconds: / (\d+ s)$/.exec(root.querySelector('.incoming-line')?.textContent ?? '')?.[1],
  // An ending is the banner's title, with OK (ADR 0086).
  line: root.querySelector('.incoming-title')?.textContent,
  bar: root.querySelector<HTMLElement>('.incoming-bar')?.hidden === false,
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
    let own: string | undefined;
    const page = host({ ownScreen: () => own });
    page.made.go = (write) => {
      const url = new URLSearchParams();
      write(url);
      page.moves.push(url.toString());
      // The lineups for this rematch show now (they name the series they follow): they ask for
      // themselves.
      own = url.has('start') ? ID : undefined;
    };
    const watch = createRematchWatch(root, page.made);
    watch.ended(ended('b'));
    await wait(100);
    expect(card()).toMatchObject({
      shown: true,
      title: 'Player 4195 wants a rematch',
      seconds: '24 s',
      buttons: ['No thanks', 'Accept'],
      bar: true,
    });
    // Tapped three times: one answer, and the player goes straight to the new lineup.
    for (let tap = 0; tap < 3; tap += 1) button('Accept')?.click();
    await wait(100);
    expect(fake.sent.filter((one) => one.method === 'POST')).toStrictEqual([
      { method: 'POST', body: { answer: 'yes' } },
    ]);
    expect(page.moves).toStrictEqual([`start=${START}`]);
    expect(card().shown).toBe(false);
    // Kept, quiet on the lineup: left without handing one in, the rematch still finds them.
    expect(page.memory.size).toBe(1);
    const asks = fake.sent.length;
    await wait(2_200);
    expect(fake.sent.length, 'the lineup asks for itself').toBe(asks);
  });

  it('waits while a fight is on, and never shows on that match’s own end screen', async () => {
    server(view({ state: 'asked', askedBy: 'a', deadline: T + 24_000 }));
    let endScreen: string | undefined = ID;
    const page = host({ ownScreen: () => endScreen });
    const watch = createRematchWatch(root, page.made);
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
    createRematchWatch(root, page.made).ended(ended('a'));
    await wait(100);
    expect(card().shown, 'the asker waits').toBe(false);
    // The tab closed and opened again: the watch is remembered.
    fake.state.answer = view({ state: 'declined', askedBy: 'a', declinedBy: 'b' });
    root.replaceChildren();
    createRematchWatch(root, page.made);
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

  it('never says again on Home an ending the end screen already said (ADR 0086)', async () => {
    server(view({ state: 'declined', askedBy: 'a', declinedBy: 'b' }));
    const page = host({ endingTold: (id) => id === ID });
    createRematchWatch(root, page.made).ended(ended('a'));
    await wait(100);
    expect(card().shown).toBe(false);
    expect(page.memory.size).toBe(0);
  });

  it('ends quietly for the one asked when the time runs out, and stops asking', async () => {
    const fake = server(view({ state: 'asked', askedBy: 'a', deadline: T + 1_000 }));
    const page = host();
    createRematchWatch(root, page.made).ended(ended('b'));
    await wait(100);
    expect(card().seconds).toBe('1 s');
    // It hides on the display's 250 ms tick that finds the deadline past (rematch-watch.ts), so by
    // the deadline plus one tick, with room for a busy runner; a fixed 1.1 s missed a late tick.
    await within(1_000 + 250 + 500, 'the banner hides at its deadline', () => !card().shown);
    fake.state.answer = view({ state: 'expired', askedBy: 'a', deadline: T + 1_000 });
    await wait(2_200);
    const asked = fake.sent.length;
    expect(card().shown).toBe(false);
    await wait(2_200);
    expect(fake.sent.length, 'nothing more can happen: no more asking').toBe(asked);
    expect(page.memory.size).toBe(0);
  });

  it('tells the one who asked of the yes, with the seconds for the lineups and Choose lineup', async () => {
    // 2026-11-23: the asker went home; the friend accepted, built a lineup and waited, and the
    // asker's phone showed nothing.
    const fake = server(view({ state: 'asked', askedBy: 'a', deadline: T + 24_000 }));
    const page = host();
    createRematchWatch(root, page.made).ended(ended('a'));
    await wait(100);
    expect(card().shown, 'waiting for the answer: no card').toBe(false);
    expect(page.backs, 'home leads back to the end screen').toStrictEqual(['answer']);
    fake.state.answer = view({ state: 'agreed', askedBy: 'a', deadline: T + 58_000, now: T });
    await wait(2_200);
    expect(card()).toMatchObject({
      shown: true,
      title: 'Player 6282 accepted',
      seconds: '58 s',
      buttons: ['Choose lineup'],
    });
    expect(page.moves, 'never moved without a tap').toStrictEqual([]);
    expect(page.backs.at(-1), 'home leads to the lineup').toBe('lineup');
    button('Choose lineup')?.click();
    await wait(50);
    expect(page.moves).toStrictEqual([`start=${START}`]);
    expect(
      fake.sent.filter((one) => one.method === 'POST'),
      'nothing to answer',
    ).toStrictEqual([]);
  });

  it('keeps the watch as long as the rematch can move: a yes gives the lineups their minute', async () => {
    server(view({ state: 'agreed', askedBy: 'a', deadline: T + 400_000 }));
    const page = host();
    createRematchWatch(root, page.made).ended(ended('a'));
    await wait(100);
    const kept = JSON.parse(page.memory.values().next().value ?? '{}') as { until: number };
    expect(kept.until).toBeGreaterThan(Date.now() + 400_000);
  });

  it('tells a player who said yes that time ran out, and moves one whose lineup was in', async () => {
    const fake = server(view({ state: 'agreed', askedBy: 'a', deadline: T + 30_000 }));
    const page = host();
    createRematchWatch(root, page.made).ended(ended('b'));
    await wait(100);
    expect(card().title).toBe('Rematch on: choose your lineup');
    fake.state.answer = view({ state: 'expired', askedBy: 'a', deadline: T + 30_000 });
    await wait(2_200);
    expect(card()).toMatchObject({
      shown: true,
      line: 'No rematch: time ran out.',
      buttons: ['OK'],
    });

    // Another device: its lineup was in and it went home; the match starts without it on screen.
    root.replaceChildren();
    const NEW = '99999999-2222-4333-8444-555555555555';
    fake.state.answer = view({
      state: 'agreed',
      askedBy: 'a',
      lineupIn: true,
      deadline: T + 30_000,
    });
    const other = host();
    createRematchWatch(root, other.made).ended(ended('a'));
    await wait(100);
    expect(card().shown, 'waiting for the other lineup: nothing to say').toBe(false);
    fake.state.answer = view({ state: 'started', askedBy: 'a', seriesId: NEW });
    await wait(2_200);
    expect(other.moves).toStrictEqual([`online=${NEW}`]);
    expect(other.memory.size).toBe(0);
  });

  it('keeps watching a match played out until its last fight ends, then hears the ask', async () => {
    // 2026-11-23 on staging: the series is finished at its last pick, while its last fight still
    // plays. The watch asked at once, heard "none, not offered yet", and forgot itself, so the
    // one who asked heard nothing of the yes later.
    const fake = server(view({ state: 'none', offered: false, now: T }));
    const page = host();
    createRematchWatch(root, page.made).ended(played('a', T + 1_000));
    await wait(100);
    expect(page.memory.size, 'not offered yet is not over').toBe(1);
    fake.state.answer = view({
      state: 'asked',
      askedBy: 'b',
      deadline: T + 32_000,
      now: T + 2_000,
    });
    await wait(2_200);
    expect(card()).toMatchObject({ shown: true, title: 'Player 6282 wants a rematch' });
    // Answered, so this watch asks nothing more of the next test's server.
    fake.state.onPost = () => view({ state: 'declined', askedBy: 'b', declinedBy: 'a' });
    button('No thanks')?.click();
    await wait(50);
    expect(page.memory.size).toBe(0);
  });

  it('asks again only when the last fight has ended, not every 2 s before', async () => {
    const fake = server(view({ state: 'none', offered: false, now: T }));
    const page = host();
    createRematchWatch(root, page.made).ended(played('b', T + 60_000));
    await wait(2_500);
    expect(fake.sent).toHaveLength(1);
    const kept = JSON.parse(page.memory.values().next().value ?? '{}') as { until: number };
    expect(kept.until, 'the watch lasts from the end').toBeGreaterThan(
      Date.now() + 60_000 + 150_000,
    );
  });
});

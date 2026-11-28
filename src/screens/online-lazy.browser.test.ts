// Online play's code as a chunk of its own (online-lazy.ts): an online screen waits for it and
// then shows as the mount draws it; a page that has played online waits on Play from the first
// frame; a chunk that fails to load shows the one failure notice with Try again, and Play stops
// waiting; Try again brings the mount, which takes over the screen on show.
import { describe, expect, it } from 'vitest';
import '../style.css';
import type { Screen } from '../app/route.ts';
import { lazyOnline, type LazyContext, type OnlineChunk } from './online-lazy.ts';
import type { MountContext, OnlineMount } from './online-mount.ts';
import { offlineMount } from './online-off.ts';
import { UNLOADED_TEXT } from './online-unloaded.ts';

/** The device has a guest: it has played online (online-device.ts). */
const GUEST_STORAGE_KEY = 'ballbattle.online.guest';

/** The Friends tab's route: a shell view (route.ts), whose handler's own route type is `never`. */
const FRIENDS_ROUTE = { screen: 'friends' } as never;

function page(): { playRow: HTMLElement } {
  const stage = document.createElement('main');
  stage.className = 'stage';
  stage.innerHTML = `<section class="hud">
      <section id="home"><div class="home-play-row"><button>Play</button></div></section>
      <div class="hud-status" id="hud-status"></div>
      <div class="hud-foot"><div id="hud-speed"></div></div>
    </section>`;
  document.body.replaceChildren(stage);
  const playRow = document.querySelector<HTMLElement>('.home-play-row');
  if (playRow === null) throw new Error('no Play row');
  return { playRow };
}

/** A mount standing in for the chunk's: it notes what it was asked to show. */
function fakeChunk(shown: string[]): OnlineChunk {
  return {
    mountOnline: (context: MountContext): OnlineMount => {
      const base = offlineMount(() => undefined);
      const note = (screen: Screen) => ({
        show: () => {
          shown.push(screen);
        },
      });
      shown.push(context.avatars === undefined ? 'mounted' : 'mounted with avatars');
      return {
        ...base,
        handlers: { ...base.handlers, friends: note('friends'), online: note('online') },
        homeShown: () => {
          shown.push('home');
        },
      };
    },
  };
}

function lazy(loads: (() => Promise<OnlineChunk>)[]) {
  const moves = { reshown: 0, laidOut: 0, back: 0 };
  const context = {
    navigation: {
      back: () => {
        moves.back += 1;
      },
    },
    go: () => undefined,
    replaceWith: () => undefined,
    goHome: () => undefined,
    showWorld: () => undefined,
    arena: () => ({}),
    worldsShown: () => 0,
    showControls: () => {
      moves.laidOut += 1;
    },
    redraw: () => undefined,
    waiting: () => undefined,
    reshow: () => {
      moves.reshown += 1;
    },
  } as unknown as LazyContext;
  const online = lazyOnline(context, () => {
    const next = loads.shift();
    if (next === undefined) throw new Error('asked once too often');
    return next();
  });
  return { online, moves };
}

const failing = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module'));

describe('online play as a chunk of its own', () => {
  it('holds an online screen until the code has come, then the mount draws it', async () => {
    page();
    const shown: string[] = [];
    const { online, moves } = lazy([() => Promise.resolve(fakeChunk(shown))]);
    expect(online.ready('home')).toBeUndefined();
    expect(online.ready('manual')).toBeUndefined();
    const waiting = online.ready('friends');
    expect(waiting).toBeInstanceOf(Promise);
    await waiting;
    expect(shown).toStrictEqual(['mounted']);
    // Laid out again, so the mount sees the screen on show.
    expect(moves.laidOut).toBe(1);
    expect(online.ready('friends')).toBeUndefined();
    online.setVisible('friends');
    online.handlers.friends.show(FRIENDS_ROUTE, 'home');
    expect(shown).toStrictEqual(['mounted', 'friends']);
  });

  it('waits on Play from the first frame on a device that has played online', async () => {
    window.localStorage.setItem(GUEST_STORAGE_KEY, '1');
    try {
      const { playRow } = page();
      const shown: string[] = [];
      let arrive = (): void => undefined;
      const { online } = lazy([
        () =>
          new Promise<OnlineChunk>((resolve) => {
            arrive = () => {
              resolve(fakeChunk(shown));
            };
          }),
      ]);
      expect(playRow.hasAttribute('data-waiting')).toBe(true);
      expect(playRow.inert).toBe(true);
      // Home shown before the code came: the mount asks the server once it has.
      online.setVisible('home');
      online.homeShown();
      arrive();
      await online.ready('friends');
      expect(shown).toStrictEqual(['mounted', 'home']);
    } finally {
      window.localStorage.removeItem(GUEST_STORAGE_KEY);
    }
  });

  it('says a failed load with Try again, and Try again brings the screen', async () => {
    window.localStorage.setItem(GUEST_STORAGE_KEY, '1');
    try {
      const { playRow } = page();
      const shown: string[] = [];
      const { online, moves } = lazy([failing, () => Promise.resolve(fakeChunk(shown))]);
      await online.ready('online');
      // Play can't wait on code that never came: it shows (vs Bot works offline).
      expect(playRow.hasAttribute('data-waiting')).toBe(false);
      expect(playRow.inert).toBe(false);
      online.setVisible('online');
      online.handlers.online.show({ screen: 'online', series: 'abc' }, 'home');
      const notice = document.getElementById('online-unloaded-screen');
      expect(notice?.hidden).toBe(false);
      expect(notice?.textContent).toContain(UNLOADED_TEXT.title);
      // The series' screen is then a task's, in the page frame.
      expect(online.noticeShown()).toBe(true);
      expect(document.activeElement?.textContent).toBe(UNLOADED_TEXT.title);
      // Back is the screen's way out.
      notice?.querySelector<HTMLButtonElement>('.screen-back')?.click();
      expect(moves.back).toBe(1);
      // Another screen laid out: the notice goes with its screen.
      online.setVisible('home');
      expect(notice?.hidden).toBe(true);
      online.setVisible('online');
      online.handlers.online.show({ screen: 'online', series: 'abc' }, 'home');
      const again = [...(notice?.querySelectorAll('button') ?? [])].find(
        (button) => button.textContent === 'Try again',
      );
      again?.click();
      await expect.poll(() => moves.reshown).toBe(1);
      expect(shown).toStrictEqual(['mounted']);
      expect(document.getElementById('online-unloaded-screen')).toBeNull();
      expect(online.noticeShown()).toBe(false);
    } finally {
      window.localStorage.removeItem(GUEST_STORAGE_KEY);
    }
  });

  it('keeps the Friends tab a tab while it says so: no Back', async () => {
    page();
    const { online } = lazy([failing]);
    await online.ready('friends');
    online.setVisible('friends');
    online.handlers.friends.show(FRIENDS_ROUTE, 'home');
    const back = document.querySelector<HTMLElement>('#online-unloaded-tab .screen-back');
    expect(back?.hidden).toBe(true);
  });
});

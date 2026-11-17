// Reveal's coin toss (ADR 0061) in a real browser: names never leave the coin or its column, at a
// phone's narrowest column and a desktop's, and a page that learns of a live toss late joins the
// flip where it has got to, so both phones show the same moment.
import { describe, expect, it } from 'vitest';
import { TOSS_FLIP_MS } from '../../api/live.ts';
import { liveToss, offlineToss } from '../../app/coin-toss.ts';
import '../../style.css';
import { createCoinToss, type TossPlay } from './coin-toss.ts';
import { playerSeats, type Seats } from './seats.ts';

const T = 1_800_000_000_000;

/** The coin's smallest size (a phone's narrowest column) and its desktop size (coin-toss.css). */
const COIN_PX = { narrow: 88, wide: 128 };

function mount(width: number, play: TossPlay) {
  const column = document.createElement('div');
  column.style.width = `${String(width)}px`;
  const toss = createCoinToss(() => undefined);
  // The coin at the size this column gets, whatever this browser's own viewport is.
  toss.element.style.setProperty(
    '--coin-size',
    `${String(width < 600 ? COIN_PX.narrow : COIN_PX.wide)}px`,
  );
  column.append(toss.element);
  document.body.replaceChildren(column);
  const stage = toss.show(play);
  return { column, root: toss.element, stage };
}

const inside = (inner: DOMRect, outer: DOMRect) =>
  inner.left >= outer.left - 0.5 &&
  inner.right <= outer.right + 0.5 &&
  inner.top >= outer.top - 0.5 &&
  inner.bottom <= outer.bottom + 0.5;

const landed = (seats: Seats, first: 'a' | 'b'): TossPlay => ({
  first,
  key: 'k',
  seats,
  times: offlineToss(T - TOSS_FLIP_MS - 100),
  now: () => T,
});

describe('the coin toss', () => {
  for (const name of ['Player 4821', 'Someone with a very long name indeed', null]) {
    for (const width of [300, 1200]) {
      it(`keeps "${String(name)}" on the coin and in its column at ${String(width)} px`, async () => {
        const seats = playerSeats('a', name);
        const { column, root, stage } = mount(width, landed(seats, 'b'));
        // Measured in the game's own font (a fallback is wider: the smaller label fits both).
        await document.fonts.ready;
        expect(stage).toBe('landed');
        expect(root.hidden).toBe(false);
        for (const face of root.querySelectorAll<HTMLElement>('.coin-toss-face')) {
          const label = face.querySelector<HTMLElement>('.coin-toss-label');
          if (label === null) throw new Error('A face with no label');
          expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth);
          // The back face is turned over: its box is the coin's either way.
          expect(inside(label.getBoundingClientRect(), face.getBoundingClientRect())).toBe(true);
        }
        const words = root.querySelector<HTMLElement>('.coin-toss-words');
        expect(words?.textContent).toBe(`${name ?? 'Deleted player'} shows first`);
        const box = words?.getBoundingClientRect();
        if (box === undefined) throw new Error('No words');
        expect(inside(box, column.getBoundingClientRect())).toBe(true);
        expect(root.scrollWidth).toBeLessThanOrEqual(column.clientWidth);
      });
    }
  }

  it('lands on the winner: the player’s face is yellow, the other’s pink', () => {
    const { root } = mount(360, landed(playerSeats('b', 'Player 4821'), 'b'));
    expect(root.querySelector('.coin-toss-coin')?.getAttribute('data-first')).toBe('you');
    const front = root.querySelector('.coin-toss-face:not(.coin-toss-back)');
    expect(front?.textContent).toBe('You');
    expect(root.querySelector('.coin-toss-back')?.textContent).toBe('P4821');
    expect(root.querySelector('.coin-toss-words')?.textContent).toBe('You show first');
  });

  it('says Get ready before a live flip, and joins a flip under way where it has got to', () => {
    const seats = playerSeats('a', 'Player 4821');
    const opensAt = T + 10_000;
    const times = liveToss(opensAt);
    const ready = mount(360, { first: 'a', key: 'k', seats, times, now: () => times.flipAt - 500 });
    expect(ready.stage).toBe('ready');
    expect(ready.root.querySelector('.coin-toss-words')?.textContent).toBe('Get ready');

    const late = mount(360, { first: 'a', key: 'k', seats, times, now: () => times.flipAt + 800 });
    expect(late.stage).toBe('flipping');
    const coin = late.root.querySelector<HTMLElement>('.coin-toss-coin');
    const [flip] = coin?.getAnimations() ?? [];
    expect(Number(flip?.currentTime)).toBeGreaterThanOrEqual(800);
    expect(Number(flip?.currentTime)).toBeLessThan(900);
  });

  it('keeps time with the server’s clock as this page’s estimate of it improves', () => {
    const seats = playerSeats('a', 'Player 4821');
    const times = liveToss(T + 10_000);
    let now = times.flipAt + 500;
    const play = { first: 'a' as const, key: 'k', seats, times, now: () => now };
    const toss = createCoinToss(() => undefined);
    document.body.replaceChildren(toss.element);
    expect(toss.show(play)).toBe('flipping');
    // A later answer moves the estimate 200 ms on: the next tick puts the coin where it should be.
    now += 200;
    expect(toss.show(play)).toBe('flipping');
    const [flip] = toss.element.querySelector('.coin-toss-coin')?.getAnimations() ?? [];
    expect(Number(flip?.currentTime)).toBeGreaterThanOrEqual(700);
    // And past the landing at once, rather than when the old timer would have fired.
    now = times.landAt + 10;
    expect(toss.show(play)).toBe('landed');
    expect(toss.element.dataset['stage']).toBe('landed');
  });

  it('is hidden once the result has been read', () => {
    const seats = playerSeats('a', 'Player 4821');
    const times = liveToss(T);
    const { root, stage } = mount(360, { first: 'a', key: 'k', seats, times, now: () => T });
    expect(stage).toBe('done');
    expect(root.hidden).toBe(true);
  });
});

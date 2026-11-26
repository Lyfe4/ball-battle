// A live round's sticker at Fight! (ADR 0054, 0055 C1): the 3-2-1 ends on "1", and the sticker
// lifts away carrying it. Nothing else shows between the count and the fight: not the sticker
// re-laid out without its line (the flash a playtest saw on two iPhones), not a pop starting over.
import { afterEach, describe, expect, it } from 'vitest';
import '../styles/tokens.css';
import './balls/pairing.css';
import './ready-card.css';
import { createTips } from '../app/tips.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { getDefinition } from '../sim/definitions.ts';
import { createWorld } from '../sim/world.ts';
import { leanOf, levelOf } from './balls/matchups.ts';
import { createReadyCard } from './ready-card.ts';

const memory = new Map<string, string>();
const storage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
};

afterEach(() => {
  document.body.replaceChildren();
  memory.clear();
});

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** What the sticker looks like on each frame until it has gone: its count line, or gone. */
async function framesUntilGone(layer: HTMLElement): Promise<string[]> {
  const seen: string[] = [];
  const started = performance.now();
  while (performance.now() - started < 1000) {
    seen.push(layer.hidden ? 'gone' : (layer.querySelector('.ready-count')?.textContent ?? ''));
    if (layer.hidden) return seen;
    await new Promise((done) => requestAnimationFrame(done));
  }
  return seen;
}

describe('a live sticker at Fight!', () => {
  it('lifts away still showing its last number, and nothing else shows before the fight', async () => {
    const container = document.createElement('div');
    container.className = 'arena-container';
    container.style.cssText = 'width: 390px; height: 390px';
    document.body.append(container);
    const card = createReadyCard(
      container,
      BALL_LOOKUP,
      createTips(() => storage),
      () => undefined,
    );
    const world = createWorld(1, [
      getDefinition(BALL_LOOKUP, 'archer'),
      getDefinition(BALL_LOOKUP, 'thorns'),
    ]);
    expect(card.start(world, 'live')).toBe(true);
    card.countdown('1');
    const layer = container.querySelector<HTMLElement>('.ready-layer');
    const sticker = container.querySelector<HTMLElement>('.ready-card');
    if (layer === null || sticker === null) throw new Error('No ready card');
    await new Promise((done) => setTimeout(done, 400));

    // The live driver at Fight!: the countdown's line goes, and the held match starts.
    card.countdown(undefined);
    expect(card.release()).toBe(true);
    if (!reducedMotion()) {
      const names = sticker.getAnimations().map((one) => (one as CSSAnimation).animationName);
      expect(names, 'the sticker lifts away').toContain('ready-lift');
    }
    const frames = await framesUntilGone(layer);
    expect(frames.at(-1)).toBe('gone');
    expect(new Set(frames.slice(0, -1)), 'only the last number, then gone').toEqual(new Set(['1']));
  });
});

// The card's mark speaks for the player (owner's decision, 2026-11-27): it sits beside the player's
// own ball, ▲ green when the player is favoured, ▼ red when not, nothing when even; never beside
// the opponent's ball, so it reads as the pick screen's legend does ("▲ you're favoured").
describe('the ready card’s mark', () => {
  function cardFor(first: string, second: string, side: 'a' | 'b' | undefined) {
    const container = document.createElement('div');
    document.body.append(container);
    const card = createReadyCard(
      container,
      BALL_LOOKUP,
      createTips(() => storage),
      () => undefined,
    );
    const world = createWorld(1, [
      getDefinition(BALL_LOOKUP, first),
      getDefinition(BALL_LOOKUP, second),
    ]);
    card.start(world, 'series', side);
    const balls = [...container.querySelectorAll('.pairing-ball')];
    const marks = balls.map((ball) => ball.querySelector<HTMLElement>('.ready-mark'));
    return { container, marks };
  }

  // A pair the counter map calls a strong counter, the first ball the losing side.
  const pairs = [...BALL_LOOKUP.keys()].flatMap((a) => [...BALL_LOOKUP.keys()].map((b) => [a, b]));
  const strong = pairs.find(
    ([a = '', b = '']) => leanOf(a, b) === 'unfavoured' && levelOf(a, b) === 'strong',
  );
  const [weak = '', strongOne = ''] = strong ?? [];

  it('shows ▼▼ beside the player’s ball when the bot’s ball is strongly favoured', () => {
    const { container, marks } = cardFor(weak, strongOne, 'a');
    expect(marks[0]?.textContent).toBe('▼▼');
    expect(marks[0]?.dataset['lean']).toBe('unfavoured');
    expect(marks[1], 'never beside the opponent’s ball').toBeNull();
    expect(container.querySelectorAll('.ready-mark')).toHaveLength(1);
    const name = BALL_LOOKUP.get(strongOne)?.name ?? '';
    expect(container.querySelector('.ready-edge')?.textContent).toBe(
      `${name} is strongly favoured`,
    );
  });

  it('shows ▲▲ beside the player’s ball when the player is on side b and favoured', () => {
    const { marks } = cardFor(weak, strongOne, 'b');
    expect(marks[0], 'never beside the opponent’s ball').toBeNull();
    expect(marks[1]?.textContent).toBe('▲▲');
    expect(marks[1]?.dataset['lean']).toBe('favoured');
  });

  it('shows no mark for a mirror', () => {
    const { container } = cardFor('archer', 'archer', 'a');
    expect(container.querySelectorAll('.ready-mark')).toHaveLength(0);
  });
});

describe('the ready card’s mark for an even pair', () => {
  it('shows nothing', () => {
    const even = [...BALL_LOOKUP.keys()].find(
      (id) => id !== 'archer' && leanOf('archer', id) === 'even',
    );
    if (even === undefined) throw new Error('No even pair for the Archer');
    const container = document.createElement('div');
    document.body.append(container);
    const card = createReadyCard(
      container,
      BALL_LOOKUP,
      createTips(() => storage),
      () => undefined,
    );
    card.start(
      createWorld(1, [getDefinition(BALL_LOOKUP, 'archer'), getDefinition(BALL_LOOKUP, even)]),
      'series',
      'a',
    );
    expect(container.querySelectorAll('.ready-mark')).toHaveLength(0);
    expect(container.querySelector('.ready-edge')?.textContent).toBe('Even matchup');
  });
});

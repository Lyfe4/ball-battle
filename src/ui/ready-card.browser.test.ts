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

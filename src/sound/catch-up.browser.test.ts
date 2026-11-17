// A live fight a page joins late (a reconnect, a page back from the background) is played on
// headlessly to the server's moment (ADR 0053, 0063): none of the sounds it skipped may play then,
// all at once. Only what plays on from there is heard.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createArena } from '../arena.ts';
import { createTips } from '../app/tips.ts';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import type { BallDefinition } from '../sim/types.ts';
import { createWorld } from '../sim/world.ts';
import { cue, installSound } from './sound.ts';

const memory = new Map<string, string>();
const storage = (): Storage =>
  ({
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  }) as unknown as Storage;

/** Every oscillator and noise burst made: each sound makes at least one. */
const oscillators = vi.spyOn(AudioContext.prototype, 'createOscillator');
const bursts = vi.spyOn(AudioContext.prototype, 'createBufferSource');
const made = () => oscillators.mock.calls.length + bursts.mock.calls.length;

afterEach(() => {
  document.body.replaceChildren();
});

function balls(...ids: string[]): BallDefinition[] {
  return ids.map((id) => {
    const definition = BALL_LOOKUP.get(id);
    if (definition === undefined) throw new Error(id);
    return definition;
  });
}

describe('a live fight caught up headlessly', () => {
  it('makes no sound for what it skipped', async () => {
    installSound(storage);
    // A real tap, so the page may start audio (as a player's first tap would).
    const tap = document.createElement('div');
    tap.textContent = 'tap';
    document.body.append(tap);
    await userEvent.click(tap);

    const container = document.createElement('div');
    container.style.width = '300px';
    container.style.height = '300px';
    const canvas = document.createElement('canvas');
    container.append(canvas);
    document.body.append(container);
    const world = createWorld(11, balls('archer', 'hex'));
    const arena = createArena(canvas, container, BALL_LOOKUP, world, {
      isPaused: () => true,
      speed: () => 1,
      afterTicks: () => undefined,
      drawn: () => undefined,
      tips: createTips(storage),
      moment: () => 'live',
    });

    const before = made();
    // Twelve seconds under way: arrows, curses and bursts have all happened by now.
    arena.showAt(world, 12_000);
    expect(arena.world().tick).toBeGreaterThan(600);
    expect(made() - before).toBe(0);
    // Sound itself works on this page: the silence above is the catch-up's, not a quiet context.
    cue('tap');
    expect(made() - before).toBeGreaterThan(0);
  });
});

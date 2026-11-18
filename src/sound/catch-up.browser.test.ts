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
import { cue, installSound, soundReady } from './sound.ts';

const memory = new Map<string, string>();
const storage = (): Storage =>
  ({
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  }) as unknown as Storage;

/** Playwright's WebKit on Linux and Windows is built without Web Audio: heard in Chromium and Firefox. */
const noAudio = !('AudioContext' in globalThis);

/** Every oscillator and noise burst made: each sound makes at least one. */
const oscillators = noAudio ? undefined : vi.spyOn(AudioContext.prototype, 'createOscillator');
const bursts = noAudio ? undefined : vi.spyOn(AudioContext.prototype, 'createBufferSource');
const made = () => (oscillators?.mock.calls.length ?? 0) + (bursts?.mock.calls.length ?? 0);
/** Fight sounds are made just after their frame (sound.ts): wait for that before counting. */
const afterFrame = () => new Promise((resolve) => setTimeout(resolve, 50));

afterEach(() => {
  document.body.replaceChildren();
});

/**
 * Waits for audio to run after the first tap; false where it never does (a machine with no audio
 * output, such as Firefox on CI), where these tests can't hear anything and skip.
 */
async function audioRuns(): Promise<boolean> {
  for (let tries = 0; tries < 40; tries += 1) {
    if (soundReady()) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

function balls(...ids: string[]): BallDefinition[] {
  return ids.map((id) => {
    const definition = BALL_LOOKUP.get(id);
    if (definition === undefined) throw new Error(id);
    return definition;
  });
}

describe.skipIf(noAudio)('a live fight caught up headlessly', () => {
  it('makes no sound for what it skipped', async (context) => {
    installSound(storage);
    // A real tap, so the page may start audio (as a player's first tap would).
    const tap = document.createElement('div');
    tap.textContent = 'tap';
    document.body.append(tap);
    await userEvent.click(tap);
    if (!(await audioRuns())) {
      context.skip('no audio output on this machine');
      return;
    }

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
      frameTip: { start: () => undefined, frame: () => undefined, settle: () => undefined },
    });

    const before = made();
    // Twelve seconds under way: arrows, curses and bursts have all happened by now.
    arena.showAt(world, 12_000);
    expect(arena.world().tick).toBeGreaterThan(600);
    await afterFrame();
    expect(made() - before).toBe(0);
    // Sound itself works on this page: the silence above is the catch-up's, not a quiet context.
    cue('tap');
    expect(made() - before).toBeGreaterThan(0);
  });
});

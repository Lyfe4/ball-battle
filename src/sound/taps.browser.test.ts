// Every control sounds when pressed (ADR 0064, amended 2026-11-19): the key moments (Play, Send
// challenge, Accept, Rematch) carry `data-sound="tap"` and tap as they always have; Back and Close
// step down; every other control (a button, a switch, a tab, a chip, a summary) gives a softer
// press, half as loud as a tap. A control with a sound of its own (`own`) adds none; a disabled or
// busy one is silent; one tap is one sound (a quick run gets quieter: rules.test.ts), Enter sounds as a tap
// does, a click the page passes on makes none, and nothing sounds with sound off.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { C6, E6 } from './voices/scale.ts';
import { installSound, setSoundSettings, soundReady } from './sound.ts';

/** Playwright's WebKit on Linux and Windows is built without Web Audio: heard in Chromium and Firefox. */
const noAudio = !('AudioContext' in globalThis);

/** Web Audio's own methods, watched (they still run): what was made, in the order it was made. */
const spies = noAudio
  ? undefined
  : {
      oscillator: vi.spyOn(AudioContext.prototype, 'createOscillator'),
      set: vi.spyOn(AudioParam.prototype, 'setValueAtTime'),
      ramp: vi.spyOn(AudioParam.prototype, 'exponentialRampToValueAtTime'),
    };

/**
 * Each tone made since the last call: its first pitch and its envelope's peak. synth.ts makes a
 * tone's oscillator, then its envelope, so a level ramped after an oscillator is that tone's.
 */
function heard(): { pitch: number; peak: number }[] {
  if (spies === undefined) return [];
  const { oscillator, set, ramp } = spies;
  const made = oscillator.mock.results.map((result, index) => ({
    frequency: (result.value as OscillatorNode).frequency,
    order: oscillator.mock.invocationCallOrder[index] ?? 0,
  }));
  const tones = made.map((tone, index) => {
    const next = made[index + 1]?.order ?? Infinity;
    const pitch = set.mock.calls.find((_, call) => set.mock.contexts[call] === tone.frequency);
    const peaks = ramp.mock.calls
      .filter((call, at) => {
        const order = ramp.mock.invocationCallOrder[at] ?? 0;
        return (
          ramp.mock.contexts[at] !== tone.frequency &&
          order > tone.order &&
          order < next &&
          call[0] < 1
        );
      })
      .map((call) => call[0]);
    return { pitch: pitch?.[0] ?? 0, peak: Math.max(0, ...peaks) };
  });
  for (const spy of [oscillator, set, ramp]) spy.mockClear();
  return tones;
}

const memory = new Map<string, string>();
const storage = (): Storage =>
  ({
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  }) as unknown as Storage;

function control(text: string, sound?: string, tag = 'button'): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = text;
  if (node instanceof HTMLButtonElement) node.type = 'button';
  if (sound !== undefined) node.dataset['sound'] = sound;
  document.body.append(node);
  return node;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Waits for audio to run after the first tap; false where it never does (a machine with no audio
 * output, such as Firefox on CI), where these tests can't hear anything and skip.
 */
async function audioRuns(): Promise<boolean> {
  for (let tries = 0; tries < 40; tries += 1) {
    if (soundReady()) return true;
    await pause(50);
  }
  return false;
}

let running = false;
beforeAll(async () => {
  if (noAudio) return;
  installSound(storage);
  // The first tap starts audio.
  await userEvent.click(control('Start'));
  running = await audioRuns();
  await pause(100);
  heard();
});
afterEach(async () => {
  document.body.replaceChildren();
  setSoundSettings({ on: true, volume: 0.7 });
  // Past the soft gate's run, so each test starts with a fresh tap.
  await pause(700);
  heard();
});

describe.skipIf(noAudio)('controls sound when pressed', () => {
  it('taps on a key moment as before, and gives every other control a softer press', async (context) => {
    if (!running) return context.skip('no audio output on this machine');
    await userEvent.click(control('Play', 'tap'));
    const [tap] = heard();
    expect(tap?.pitch).toBe(1500);
    await pause(700);
    await userEvent.click(control('Change balls'));
    const [press] = heard();
    expect(press?.pitch).toBe(E6);
    expect(press?.peak).toBeLessThanOrEqual((tap?.peak ?? 0) / 2 + 1e-6);
    await pause(700);
    await userEvent.click(control('Back', 'back'));
    expect(heard().map((one) => one.pitch)).toStrictEqual([C6]);
    await pause(700);
    for (const tag of ['summary', 'a']) {
      const node = control('More', undefined, tag);
      if (node instanceof HTMLAnchorElement) {
        node.href = '#';
        // Never followed: an entry in this frame's history would join the history every test
        // file's frame shares, and another file's Back could land on it.
        node.addEventListener('click', (event) => {
          event.preventDefault();
        });
      }
      await userEvent.click(node);
      expect(heard(), tag).toHaveLength(1);
      await pause(700);
    }
  });

  it('is one sound per tap: none for a control with its own, a disabled or busy one, or a click passed on', async (context) => {
    if (!running) return context.skip('no audio output on this machine');
    await userEvent.click(control('Fight!', 'own'));
    const off = control('Send challenge', 'tap');
    (off as HTMLButtonElement).disabled = true;
    await userEvent.click(off, { force: true });
    const busy = control('Accept', 'tap');
    busy.setAttribute('aria-busy', 'true');
    await userEvent.click(busy);
    expect(heard()).toStrictEqual([]);
    // A row that is a control of its own, with a button inside it: one sound. A handler that
    // passes the click on to another control: still one.
    const row = control('', undefined, 'div');
    row.setAttribute('role', 'button');
    const inner = document.createElement('button');
    inner.textContent = 'Inner';
    row.append(inner);
    const other = control('Other');
    inner.addEventListener('click', () => {
      other.click();
    });
    await userEvent.click(inner);
    expect(heard()).toHaveLength(1);
  });

  it('sounds once a tap through a quick run, and on Enter', async (context) => {
    if (!running) return context.skip('no audio output on this machine');
    const next = control('Next');
    // How much quieter a run gets is the gate's (rules.test.ts): a loaded browser can't promise the
    // gaps between taps, only that no tap sounds twice.
    for (let tap = 0; tap < 5; tap += 1) await userEvent.click(next);
    const peaks = heard().map((one) => one.peak);
    expect(peaks.length).toBeGreaterThanOrEqual(1);
    expect(peaks.length).toBeLessThanOrEqual(5);
    expect(Math.max(...peaks)).toBeLessThanOrEqual(0.06 + 1e-6);
    await pause(700);
    next.focus();
    await userEvent.keyboard('{Enter}');
    expect(heard()).toHaveLength(1);
  });

  it('is silent with sound off', async (context) => {
    if (!running) return context.skip('no audio output on this machine');
    setSoundSettings({ on: false, volume: 0.7 });
    await userEvent.click(control('Play', 'tap'));
    await userEvent.click(control('Change balls'));
    expect(heard()).toStrictEqual([]);
  });
});

// Buttons tap only on the key moments (ADR 0064): Play, Send challenge, Accept challenge and
// Rematch carry `data-sound="tap"`; every other button is quiet, and a disabled one never taps.
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { installSound, soundReady } from './sound.ts';

/** Playwright's WebKit on Linux and Windows is built without Web Audio: heard in Chromium and Firefox. */
const noAudio = !('AudioContext' in globalThis);
const oscillators = noAudio ? undefined : vi.spyOn(AudioContext.prototype, 'createOscillator');
const made = () => oscillators?.mock.calls.length ?? 0;

const memory = new Map<string, string>();
const storage = (): Storage =>
  ({
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  }) as unknown as Storage;

function button(text: string, tap: boolean, disabled = false): HTMLButtonElement {
  const press = document.createElement('button');
  press.type = 'button';
  press.textContent = text;
  if (tap) press.dataset['sound'] = 'tap';
  press.disabled = disabled;
  document.body.append(press);
  return press;
}

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

describe.skipIf(noAudio)('button taps', () => {
  it('sound on the key moments only', async (context) => {
    installSound(storage);
    const plain = button('Change balls', false);
    const play = button('Play', true);
    const waiting = button('Send challenge', true, true);
    // The first tap starts audio.
    await userEvent.click(plain);
    if (!(await audioRuns())) {
      context.skip('no audio output on this machine');
      return;
    }
    const before = made();
    await userEvent.click(plain);
    expect(made()).toBe(before);
    await userEvent.click(waiting, { force: true });
    expect(made()).toBe(before);
    await userEvent.click(play);
    expect(made()).toBeGreaterThan(before);
  });
});

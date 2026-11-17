// Buttons tap only on the key moments (ADR 0064): Play, Send challenge, Accept challenge and
// Rematch carry `data-sound="tap"`; every other button is quiet, and a disabled one never taps.
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { installSound } from './sound.ts';

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

describe.skipIf(noAudio)('button taps', () => {
  it('sound on the key moments only', async () => {
    installSound(storage);
    const plain = button('Change balls', false);
    const play = button('Play', true);
    const waiting = button('Send challenge', true, true);
    // The first tap starts audio.
    await userEvent.click(plain);
    const before = made();
    await userEvent.click(plain);
    expect(made()).toBe(before);
    await userEvent.click(waiting, { force: true });
    expect(made()).toBe(before);
    await userEvent.click(play);
    expect(made()).toBeGreaterThan(before);
  });
});

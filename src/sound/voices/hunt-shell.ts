// The Hunter and the Tortoise (ADR 0091, 0064): a snare's steel jaws snapping shut, the Hunter's
// heavy bump on slow prey, and the Tortoise's shell knocking as it ducks in.
import { noise, tone } from '../synth.ts';
import { A3, A5, C3, D4, E5, type Voice } from './scale.ts';

export const HUNT_SHELL_VOICES = {
  /**
   * A snare springs: a dry steel snap, the jaws clacking shut with a small spring ring after,
   * quieter on a snare that shuts on nothing.
   */
  snap(kit, at, { gain, detune }) {
    const level = 0.5 + 0.5 * gain;
    noise(kit, { filter: 'highpass', from: 3200, at, length: 0.012, gain: 0.45 * level });
    noise(kit, {
      filter: 'bandpass',
      from: 1300,
      q: 3,
      at: at + 0.016,
      length: 0.03,
      gain: 0.3 * level,
    });
    tone(kit, {
      type: 'triangle',
      from: A5,
      to: E5,
      glide: 0.03,
      at: at + 0.016,
      length: 0.08,
      gain: 0.1 * level,
      detune,
    });
  },
  /**
   * The Hunter's bump lands hard on slow prey: a deep, heavy thump with a slap of leather on top,
   * lower and longer than a plain bump.
   */
  thump(kit, at, { gain, detune }) {
    const level = 0.6 + 0.4 * gain;
    tone(kit, { from: A3, to: C3, glide: 0.05, at, length: 0.26, gain: 0.6 * level, detune });
    noise(kit, { filter: 'lowpass', from: 320, at, length: 0.12, gain: 0.5 * level });
    noise(kit, {
      filter: 'bandpass',
      from: 1100,
      q: 2.5,
      at: at + 0.005,
      length: 0.035,
      gain: 0.22 * level,
    });
  },
  /**
   * The Tortoise's shell takes a hit as it ducks in: a soft, hollow double knock on wood ("tok-tok",
   * the second quieter), low and dry, quieter than the bump it comes with.
   */
  knock(kit, at, { gain, detune }) {
    const level = 0.5 + 0.5 * gain;
    [0, 0.07].forEach((after, index) => {
      const when = at + after;
      const loud = (index === 0 ? 1 : 0.55) * level;
      tone(kit, { from: D4, at: when, length: 0.05, gain: 0.28 * loud, detune });
      tone(kit, { from: D4 * 2.4, at: when, length: 0.025, gain: 0.06 * loud, detune });
      noise(kit, { filter: 'lowpass', from: 700, at: when, length: 0.02, gain: 0.15 * loud });
    });
  },
} satisfies Record<string, Voice>;

// Balls whose ability is a trick of where a hit meets them: the Mirage's copy shimmering in and
// popping like glass, the Jouster's gallop as it charges, its lance splintering head-on and only
// scraping a spark at a glance (ADR 0064).
import { noise, tone } from '../synth.ts';
import { C4, C6, D6, E4, E6, G3, G4, G6, type Voice } from './scale.ts';

export const TRICK_VOICES = {
  /**
   * The Mirage's copy appears: a soft, glassy shimmer rising, high notes climbing in pairs that beat
   * against each other, on a thin breath of air.
   */
  shimmer(kit, at) {
    [C6, E6, G6].forEach((pitch, index) => {
      for (const cents of [0, 14]) {
        tone(kit, {
          from: pitch,
          at: at + index * 0.07,
          length: 0.3 - index * 0.05,
          gain: 0.045,
          detune: cents,
          attack: 0.05,
        });
      }
    });
    noise(kit, {
      filter: 'bandpass',
      from: 5000,
      to: 9000,
      q: 3,
      at,
      length: 0.35,
      gain: 0.06,
      attack: 0.15,
    });
  },
  /**
   * A shot pops the copy: a brittle glass bead bursting, a tiny tick, a bubble's "plip" jumping up
   * and a bright bell-like ping that rings off at once.
   */
  copyPop(kit, at, { gain, detune }) {
    const level = 0.6 + 0.4 * gain;
    noise(kit, { filter: 'highpass', from: 7500, at, length: 0.015, gain: 0.3 * level });
    tone(kit, { from: 700, to: 2100, glide: 0.025, at, length: 0.04, gain: 0.2 * level, detune });
    tone(kit, { from: D6, at: at + 0.02, length: 0.14, gain: 0.12 * level, detune });
    tone(kit, { from: D6 * 2.76, at: at + 0.02, length: 0.07, gain: 0.05 * level, detune });
  },
  /**
   * The Jouster lowers its lance and charges: three hoofbeats, each a step higher and quicker, under
   * a short rising call.
   */
  charge(kit, at) {
    for (const [pitch, after] of [
      [G3, 0],
      [C4, 0.075],
      [E4, 0.135],
    ] as const) {
      const when = at + after;
      tone(kit, {
        type: 'triangle',
        from: pitch * 1.5,
        to: pitch,
        glide: 0.03,
        at: when,
        length: 0.05,
        gain: 0.2,
      });
      noise(kit, { filter: 'lowpass', from: 900, at: when, length: 0.03, gain: 0.12 });
    }
    tone(kit, {
      type: 'sawtooth',
      from: C4,
      to: G4,
      glide: 0.12,
      at: at + 0.12,
      length: 0.16,
      gain: 0.06,
      soften: 1200,
      attack: 0.03,
    });
  },
  /**
   * The lance lands head-on: wood splintering, a quick run of dry cracks over a heavy punch and the
   * shaft's hollow knock.
   */
  splinter(kit, at, { gain, detune }) {
    const level = 0.6 + 0.4 * gain;
    tone(kit, { from: 220, to: 55, glide: 0.1, at, length: 0.16, gain: 0.5 * level, detune });
    [2800, 1900, 3600, 2300].forEach((hz, index) => {
      noise(kit, {
        filter: 'bandpass',
        from: hz,
        q: 4,
        at: at + index * 0.022,
        length: 0.04,
        gain: (0.4 - index * 0.07) * level,
      });
    });
    tone(kit, {
      type: 'triangle',
      from: G3,
      to: G3 * 0.9,
      at: at + 0.01,
      length: 0.14,
      gain: 0.16 * level,
      detune,
    });
  },
  /** The lance glances off: a thin metallic scrape and two small sparks, lighter than a bump. */
  spark(kit, at, { gain, detune }) {
    const level = 0.5 + 0.5 * gain;
    noise(kit, {
      filter: 'bandpass',
      from: 4000,
      to: 7500,
      q: 9,
      at,
      length: 0.07,
      gain: 0.16 * level,
    });
    tone(kit, { from: G6 * 1.5, at: at + 0.03, length: 0.03, gain: 0.04 * level, detune });
    tone(kit, { from: E6 * 1.5, at: at + 0.06, length: 0.03, gain: 0.03 * level, detune });
  },
} satisfies Record<string, Voice>;

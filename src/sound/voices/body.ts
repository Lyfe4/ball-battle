// Balls whose ability lives in their own body: the Berserker's growl and smash, the Speedster's
// whip-crack, the Titan's stretch, the Thorns' spikes biting back, the Ghost slipping out of the
// world, the Magnet's hum.
import { noise, tone } from '../synth.ts';
import { A4, A5, C4, C5, C6, E5, E6, G4, G5, type Voice } from './scale.ts';

export const BODY_VOICES = {
  /** The Berserker takes a hit and gets angrier: a short low growl, rougher with more rage. */
  rage(kit, at, { gain }) {
    tone(kit, {
      type: 'sawtooth',
      from: 82,
      to: 98,
      at,
      length: 0.16,
      gain: 0.14 * (0.5 + 0.5 * gain),
      soften: 500 + 500 * gain,
      attack: 0.03,
    });
  },
  /** It lets the rage out on a bump: a short roar, two rough voices beating, bigger with more rage. */
  rageHit(kit, at, { gain }) {
    for (const cents of [0, 45]) {
      tone(kit, {
        type: 'sawtooth',
        from: 110,
        to: 147,
        glide: 0.08,
        at,
        length: 0.24,
        gain: 0.14 + 0.08 * gain,
        soften: 1700,
        detune: cents,
        attack: 0.015,
      });
    }
    noise(kit, { filter: 'bandpass', from: 900, q: 1.5, at, length: 0.12, gain: 0.25 * gain });
  },
  /** The Speedster's boosted hit: a whip-crack, the zip before it longer with more speed built. */
  speedHit(kit, at, { gain, detune }) {
    const zip = 0.04 + 0.06 * gain;
    tone(kit, { from: C5, to: C6 * 1.5, glide: zip, at, length: zip, gain: 0.12, detune });
    noise(kit, {
      filter: 'highpass',
      from: 4000,
      at: at + zip,
      length: 0.04,
      gain: 0.35 * (0.5 + 0.5 * gain),
    });
    tone(kit, { from: 300, to: 120, at: at + zip, length: 0.1, gain: 0.3 * gain });
  },
  /** The Titan grows a step: a deep, slow stretch upward, like a balloon filling. */
  grow(kit, at, { gain }) {
    tone(kit, {
      type: 'triangle',
      from: C4 / 2,
      to: G4 / 2,
      glide: 0.4,
      at,
      length: 0.5,
      gain: 0.32,
      attack: 0.15,
    });
    tone(kit, {
      from: C4,
      to: G4,
      glide: 0.4,
      at,
      length: 0.45,
      gain: 0.08 + 0.06 * gain,
      attack: 0.15,
    });
  },
  /** The spikes bite back: a quick metallic "shing", like a blade drawn. */
  thorns(kit, at, { gain, detune }) {
    noise(kit, {
      filter: 'bandpass',
      from: 6500,
      to: 3500,
      q: 7,
      at,
      length: 0.12,
      gain: 0.22 * (0.6 + 0.4 * gain),
    });
    tone(kit, { from: E6 * 1.5, to: E6, glide: 0.1, at, length: 0.14, gain: 0.06, detune });
    tone(kit, { from: E6 * 2.03, at, length: 0.08, gain: 0.03, detune });
  },
  /** The Ghost phases out: an airy shimmer that bends down, see-through. */
  phaseIn(kit, at) {
    noise(kit, {
      filter: 'bandpass',
      from: 3000,
      to: 1200,
      q: 2,
      at,
      length: 0.35,
      gain: 0.09,
      attack: 0.12,
    });
    tone(kit, { from: A5, to: E5, glide: 0.3, at, length: 0.35, gain: 0.05, attack: 0.1 });
    tone(kit, {
      from: A5,
      to: E5,
      glide: 0.3,
      at,
      length: 0.35,
      gain: 0.05,
      attack: 0.1,
      detune: 22,
    });
  },
  /** It passes through a ball and hits it from inside: a hollow "whoo" with a soft knock in it. */
  ghostPass(kit, at, { gain }) {
    tone(kit, {
      from: A4,
      to: G4 / 1.5,
      glide: 0.22,
      at,
      length: 0.26,
      gain: 0.2 * (0.6 + 0.4 * gain),
      attack: 0.04,
    });
    noise(kit, { filter: 'bandpass', from: 900, q: 1, at, length: 0.22, gain: 0.12, attack: 0.05 });
  },
  /** The Magnet pulls: a wobbling hum rising, stronger when a shot set it off. */
  pull(kit, at, { gain }) {
    const level = 0.12 * (0.6 + 0.4 * gain);
    tone(kit, {
      type: 'square',
      from: 70,
      to: 140,
      at,
      length: 0.4,
      gain: level,
      soften: 600,
      attack: 0.08,
    });
    tone(kit, { from: 70, to: 140, at, length: 0.4, gain: level, detune: 40, attack: 0.08 });
    tone(kit, { from: G5, to: C6, at: at + 0.25, length: 0.15, gain: 0.04 * gain });
  },
} satisfies Record<string, Voice>;

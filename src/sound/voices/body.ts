// Balls whose ability lives in their own body: the Berserker's growl and smash, the Speedster's
// whip-crack, the Titan's stretch, the Thorns' spikes biting back, the Ghost slipping out of the
// world, the Magnet's hum, the Balloon's squeak, squash and pop.
import { noise, tone } from '../synth.ts';
import { A4, A5, C3, C4, C5, C6, D5, E5, E6, G3, G4, G5, G6, type Voice } from './scale.ts';

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
    tone(kit, { from: G6, to: E6, glide: 0.1, at, length: 0.14, gain: 0.06, detune });
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
  /**
   * The Balloon bumps a ball: a rubbery squeak that stretches up and back, two voices rubbing, over
   * a light hollow thump (it floats, so it never lands heavy like the shared bump).
   */
  squeak(kit, at, { gain, detune }) {
    const level = 0.6 + 0.4 * gain;
    for (const cents of [0, 38]) {
      tone(kit, {
        type: 'triangle',
        from: C5,
        to: G5,
        glide: 0.05,
        at,
        length: 0.07,
        gain: 0.1 * level,
        detune: detune + cents,
      });
      tone(kit, {
        type: 'triangle',
        from: G5,
        to: D5,
        glide: 0.08,
        at: at + 0.055,
        length: 0.09,
        gain: 0.09 * level,
        detune: detune + cents,
      });
    }
    tone(kit, { from: G3, to: C3, glide: 0.1, at, length: 0.12, gain: 0.22 * gain, detune });
  },
  /**
   * An area hit glances off the floating Balloon: it squashes and springs back, a wobbling
   * "bwoing" (two voices beating as they bend down) on a soft cushion of air.
   */
  squash(kit, at, { gain, detune }) {
    const level = 0.6 + 0.4 * gain;
    for (const cents of [0, -48]) {
      tone(kit, {
        type: 'triangle',
        from: E5,
        to: C5,
        glide: 0.2,
        at,
        length: 0.26,
        gain: 0.11 * level,
        detune: detune + cents,
        attack: 0.01,
      });
    }
    tone(kit, { from: C4, to: G3, glide: 0.08, at, length: 0.12, gain: 0.18 * level });
    noise(kit, { filter: 'lowpass', from: 1200, to: 350, at, length: 0.12, gain: 0.12 * gain });
  },
  /**
   * A shot hits the Balloon harder: a sharp snap, the rubber's deep "thoomp" as it gives, a bright
   * ping and a rush of air.
   */
  pop(kit, at, { gain }) {
    const level = 0.6 + 0.4 * gain;
    noise(kit, { filter: 'highpass', from: 5000, at, length: 0.03, gain: 0.45 * level });
    tone(kit, { from: 340, to: 90, glide: 0.07, at, length: 0.1, gain: 0.38 * level });
    tone(kit, { from: E6, to: A5, glide: 0.03, at, length: 0.05, gain: 0.2 });
    noise(kit, {
      filter: 'bandpass',
      from: 3200,
      to: 900,
      q: 1.5,
      at: at + 0.02,
      length: 0.16,
      gain: 0.14 * level,
      attack: 0.01,
    });
  },
} satisfies Record<string, Voice>;

// Balls that change health or time, the ones whose counters are heard working: the Frost's chill,
// the Venom's poison, the Vampire's sip, the Bloom opening and shutting, the Chrono's rewind, the
// Battery's charge and release, the Hex's curse, the Slime's split.
import { noise, tone } from '../synth.ts';
import { A4, A5, C4, C5, C6, D5, D6, E5, E6, G4, G5, G6, type Voice } from './scale.ts';

export const LIFE_VOICES = {
  /** The Frost slows a ball: glassy crystals tinkling, with a cold breath under them. */
  frost(kit, at, { detune }) {
    [G6, D6, E6].forEach((pitch, index) => {
      tone(kit, { from: pitch, at: at + index * 0.03, length: 0.18, gain: 0.05, detune });
    });
    noise(kit, { filter: 'highpass', from: 7000, at, length: 0.2, gain: 0.07, attack: 0.02 });
  },
  /** The Venom poisons a ball: a thick bubbling glug. */
  poison(kit, at) {
    [0, 0.06, 0.11].forEach((when, index) => {
      tone(kit, {
        from: 260 + index * 70,
        to: 420 + index * 90,
        glide: 0.04,
        at: at + when,
        length: 0.05,
        gain: 0.16,
      });
    });
  },
  /** The poison bites again: one small drip. */
  poisonTick(kit, at, { gain, detune }) {
    tone(kit, {
      from: 900,
      to: 520,
      glide: 0.04,
      at,
      length: 0.06,
      gain: 0.1 * (0.6 + 0.4 * gain),
      detune,
    });
  },
  /** The Vampire drinks: a dark sip rising into a soft swell. */
  drain(kit, at, { gain }) {
    noise(kit, {
      filter: 'bandpass',
      from: 500,
      to: 1500,
      q: 3,
      at,
      length: 0.16,
      gain: 0.14,
      attack: 0.04,
    });
    tone(kit, {
      type: 'triangle',
      from: A4 / 2,
      to: E5 / 2,
      glide: 0.2,
      at: at + 0.05,
      length: 0.3,
      gain: 0.18 * (0.6 + 0.4 * gain),
      attack: 0.06,
    });
    tone(kit, {
      from: A4,
      to: E5,
      glide: 0.2,
      at: at + 0.05,
      length: 0.3,
      gain: 0.05,
      attack: 0.06,
      detune: 15,
    });
  },
  /** The Bloom starts to regrow: petals opening, a soft rising chime. */
  bloomOpen(kit, at) {
    [C5, E5, G5, C6].forEach((pitch, index) => {
      tone(kit, { from: pitch, at: at + index * 0.07, length: 0.3, gain: 0.07, attack: 0.03 });
    });
  },
  /** A hit makes it wait again: the chime pinched shut, falling. */
  bloomShut(kit, at) {
    tone(kit, { type: 'triangle', from: G5, to: D5, glide: 0.08, at, length: 0.12, gain: 0.12 });
    noise(kit, { filter: 'bandpass', from: 2400, q: 4, at, length: 0.03, gain: 0.08 });
  },
  /** The Chrono rewinds a hit: a sound played backwards, swelling up to a sudden stop. */
  rewind(kit, at, { gain }) {
    const length = 0.4;
    noise(kit, {
      filter: 'bandpass',
      from: 600,
      to: 3000,
      q: 2,
      at,
      length,
      gain: 0.18,
      attack: length - 0.02,
    });
    tone(kit, {
      type: 'triangle',
      from: E6,
      to: C5,
      glide: length,
      at,
      length,
      gain: 0.14 * (0.6 + 0.4 * gain),
      attack: length - 0.03,
    });
    tone(kit, { from: A5, at: at + length, length: 0.12, gain: 0.08 });
  },
  /** The Battery soaks a big hit: a short rising charge, longer for more. */
  store(kit, at, { gain }) {
    const length = 0.12 + 0.12 * gain;
    tone(kit, {
      type: 'sawtooth',
      from: 180,
      to: 720,
      at,
      length,
      gain: 0.2,
      soften: 1600,
      attack: 0.02,
    });
    tone(kit, { from: C5, to: C6, at, length, gain: 0.1, attack: 0.02 });
  },
  /** The Battery lets it all out on a bump: a bright zap falling into a boom, bigger for more. */
  release(kit, at, { gain }) {
    tone(kit, {
      type: 'square',
      from: 1400,
      to: 90,
      glide: 0.18,
      at,
      length: 0.26,
      gain: 0.15 + 0.12 * gain,
      soften: 2600,
    });
    tone(kit, { from: 160, to: 50, glide: 0.2, at, length: 0.3, gain: 0.38 + 0.2 * gain });
    noise(kit, { filter: 'bandpass', from: 4000, to: 900, q: 1.5, at, length: 0.16, gain: 0.25 });
  },
  /** The Hex marks a ball: two close notes wobbling against each other, quiet and a little eerie. */
  curse(kit, at, { gain }) {
    tone(kit, { from: E5, to: D5, glide: 0.3, at, length: 0.36, gain: 0.16 * gain, attack: 0.03 });
    tone(kit, {
      from: E5,
      to: D5,
      glide: 0.3,
      at,
      length: 0.36,
      gain: 0.16 * gain,
      attack: 0.03,
      detune: 28,
    });
    tone(kit, {
      type: 'triangle',
      from: A5,
      at: at + 0.02,
      length: 0.2,
      gain: 0.06 * gain,
      attack: 0.02,
    });
  },
  /** The curse bursts: a hollow whump with a crackle and a sparkle falling off it. */
  curseBurst(kit, at, { gain }) {
    tone(kit, { from: 220, to: 45, glide: 0.25, at, length: 0.32, gain: 0.7 * (0.6 + 0.4 * gain) });
    noise(kit, { filter: 'bandpass', from: 1400, to: 400, q: 0.8, at, length: 0.22, gain: 0.3 });
    tone(kit, {
      type: 'triangle',
      from: C6,
      to: E5,
      glide: 0.2,
      at: at + 0.03,
      length: 0.24,
      gain: 0.12,
    });
  },
  /** The Slime splits: a wet splat and two bloops gliding apart, one up and one down. */
  split(kit, at) {
    noise(kit, { filter: 'lowpass', from: 1800, to: 250, at, length: 0.14, gain: 0.35 });
    tone(kit, { from: G4, to: C5 * 1.5, glide: 0.16, at: at + 0.03, length: 0.2, gain: 0.3 });
    tone(kit, { from: G4, to: C4 * 0.75, glide: 0.16, at: at + 0.03, length: 0.2, gain: 0.3 });
  },
} satisfies Record<string, Voice>;

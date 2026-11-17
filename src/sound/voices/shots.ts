// Balls that hit from range: each shot's sound says what it is. The Archer's light stream, the
// Boomerang's whirr that hits both ways, the Sniper's lock and crack, the Spartan's shield and
// spear, the Necromancer's rattling skeleton.
import { noise, tone, type Kit } from '../synth.ts';
import { A4, A5, C4, C5, C6, D6, E4, E5, E6, G4, G5, G6, type Play, type Voice } from './scale.ts';

/** A hollow wooden knock from `high` to `low`, with a little click on top. */
const thok: (kit: Kit, at: number, play: Play, high: number, low: number) => void = (
  kit,
  at,
  { gain, detune },
  high,
  low,
) => {
  tone(kit, {
    type: 'triangle',
    from: high,
    to: low,
    glide: 0.05,
    at,
    length: 0.11,
    gain: 0.36 * (0.6 + 0.4 * gain),
    detune,
  });
  noise(kit, { filter: 'bandpass', from: 700, q: 2, at, length: 0.05, gain: 0.18 });
};

export const SHOT_VOICES = {
  /** The Archer looses: a quick airy "fwip" that falls in pitch. */
  arrowFire(kit, at, { gain }) {
    noise(kit, {
      filter: 'bandpass',
      from: 5200,
      to: 1600,
      q: 3,
      at,
      length: 0.08,
      gain: 0.32 * gain,
      attack: 0.008,
    });
  },
  /** An arrow lands: a small woody "tock". */
  arrowHit(kit, at, { gain, detune }) {
    tone(kit, {
      type: 'triangle',
      from: G5,
      to: G4,
      glide: 0.04,
      at,
      length: 0.07,
      gain: 0.32 * (0.6 + 0.4 * gain),
      detune,
    });
    noise(kit, { filter: 'bandpass', from: 1800, q: 4, at, length: 0.03, gain: 0.2 });
  },
  /** The Boomerang throws: a spinning whirr, the noise beating as it turns away. */
  boomThrow(kit, at, { gain }) {
    for (let turn = 0; turn < 4; turn += 1) {
      noise(kit, {
        filter: 'bandpass',
        from: 900 + turn * 120,
        q: 4,
        at: at + turn * 0.045,
        length: 0.05,
        gain: 0.36 * gain * (1 - turn * 0.18),
        attack: 0.01,
      });
    }
  },
  /** A boomerang hits going out: a hollow wooden "thok". */
  boomHit(kit, at, play) {
    thok(kit, at, play, G4, C4);
  },
  /** It hits again coming back: the same "thok" a step higher, so both hits are heard as one throw. */
  boomBack(kit, at, play) {
    thok(kit, at, play, C5, E4);
  },
  /** The Boomerang catches it: a soft slap and a small rising note. */
  boomCatch(kit, at) {
    noise(kit, { filter: 'lowpass', from: 1200, at, length: 0.04, gain: 0.2 });
    tone(kit, {
      type: 'triangle',
      from: G5,
      to: C6,
      glide: 0.06,
      at: at + 0.02,
      length: 0.1,
      gain: 0.12,
    });
  },
  /** The Sniper locks on: two quick high beeps, a warning. */
  lockOn(kit, at) {
    tone(kit, { from: D6, at, length: 0.05, gain: 0.12 });
    tone(kit, { from: D6, at: at + 0.09, length: 0.07, gain: 0.12 });
  },
  /** The Sniper fires: a dry crack with a falling ring. */
  snipe(kit, at, { gain }) {
    noise(kit, { filter: 'highpass', from: 2500, at, length: 0.05, gain: 0.35 * gain });
    tone(kit, {
      type: 'triangle',
      from: G6,
      to: G5,
      glide: 0.12,
      at,
      length: 0.2,
      gain: 0.12 * gain,
    });
  },
  /** A sniper shot lands: a heavy punch with a high metallic "pank" ringing off it. */
  snipeHit(kit, at, { gain }) {
    tone(kit, { from: 120, to: 60, glide: 0.06, at, length: 0.1, gain: 0.4 * (0.6 + 0.4 * gain) });
    tone(kit, { from: 2637, to: 2490, at, length: 0.3, gain: 0.1 });
    tone(kit, { from: 3950, at, length: 0.15, gain: 0.04 });
  },
  /** The Spartan plants its shield: a short metal clang. */
  shieldUp(kit, at) {
    tone(kit, { from: 1180, at, length: 0.28, gain: 0.08 });
    tone(kit, { from: 1660, at, length: 0.2, gain: 0.05 });
    tone(kit, { from: 220, to: 160, at, length: 0.08, gain: 0.25 });
  },
  /** A hit glances off the shield: a bright ricochet "ting" sliding up. */
  glance(kit, at, { gain, detune }) {
    tone(kit, {
      from: 2100,
      to: 3100,
      glide: 0.08,
      at,
      length: 0.16,
      gain: 0.1 * (0.6 + 0.4 * gain),
      detune,
    });
    noise(kit, { filter: 'highpass', from: 5000, at, length: 0.02, gain: 0.12 });
  },
  /** The Spartan throws its spear: a heavy, low whoosh. */
  spear(kit, at) {
    noise(kit, {
      filter: 'bandpass',
      from: 500,
      to: 1400,
      q: 2,
      at,
      length: 0.16,
      gain: 0.3,
      attack: 0.04,
    });
  },
  /** The spear strikes: a dry woody crack and a short low knock, like a stake driven home. */
  spearHit(kit, at, { gain }) {
    noise(kit, {
      filter: 'bandpass',
      from: 1300,
      to: 700,
      q: 3,
      at,
      length: 0.07,
      gain: 0.45 * (0.6 + 0.4 * gain),
    });
    tone(kit, { from: 180, to: 110, at, length: 0.07, gain: 0.25 });
  },
  /** The Necromancer raises a skeleton: bones rattling up the scale. */
  raise(kit, at) {
    [A4, C5, E5, A5].forEach((pitch, index) => {
      tone(kit, { type: 'triangle', from: pitch, at: at + index * 0.05, length: 0.05, gain: 0.12 });
      noise(kit, {
        filter: 'bandpass',
        from: 3000,
        q: 6,
        at: at + index * 0.05,
        length: 0.015,
        gain: 0.1,
      });
    });
  },
  /** A skeleton bites: a dry double clack, teeth together. */
  bite(kit, at, { gain, detune }) {
    for (const when of [0, 0.05]) {
      noise(kit, {
        filter: 'bandpass',
        from: 2200,
        q: 8,
        at: at + when,
        length: 0.025,
        gain: 0.3 * gain,
      });
      tone(kit, {
        type: 'triangle',
        from: E6,
        to: E5,
        glide: 0.02,
        at: at + when,
        length: 0.03,
        gain: 0.07,
        detune,
      });
    }
  },
  /** A skeleton is broken: bones scattering down. */
  boneBreak(kit, at) {
    [E6, C6, A5, E5, C5].forEach((pitch, index) => {
      tone(kit, {
        type: 'triangle',
        from: pitch,
        at: at + index * 0.035,
        length: 0.04,
        gain: 0.08,
      });
    });
    noise(kit, { filter: 'bandpass', from: 2600, to: 900, q: 2, at, length: 0.18, gain: 0.15 });
  },
} satisfies Record<string, Voice>;

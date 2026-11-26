// The sounds every ball makes: a bump, a hit from anything without a voice of its own, a
// knockout, and the bell for a match that ends without one (the time limit, a draw). The Brawler has no ability, so these are all it says.
import { noise, tone } from '../synth.ts';
import { A5, C6, E6, G5, type Voice } from './scale.ts';

export const SHARED_VOICES = {
  /** Two rubber balls meeting: a pitch-dropping thump and a soft click; harder is lower and louder. */
  bump(kit, at, { gain, detune }) {
    const low = 1 - gain * 0.35;
    tone(kit, {
      from: 330 * low,
      to: 120 * low,
      glide: 0.09,
      at,
      length: 0.16,
      gain: 0.55 * gain,
      detune,
    });
    noise(kit, { filter: 'bandpass', from: 2400, q: 1.2, at, length: 0.03, gain: 0.25 * gain });
  },
  /** A projectile or strike that isn't one of the voiced abilities: a short, bright tap. */
  hit(kit, at, { gain, detune }) {
    tone(kit, { type: 'triangle', from: 880, to: 440, at, length: 0.07, gain: 0.3 * gain, detune });
    noise(kit, { filter: 'highpass', from: 3000, at, length: 0.025, gain: 0.15 * gain });
  },
  /** A ball pops: a big bloop that falls away, then three shards tinkling down the scale. */
  knockout(kit, at, { gain, detune }) {
    tone(kit, { from: 520, to: 70, glide: 0.38, at, length: 0.45, gain: 0.7 * gain, detune });
    noise(kit, { filter: 'lowpass', from: 3500, to: 300, at, length: 0.3, gain: 0.35 * gain });
    [E6, C6, A5].forEach((pitch, index) => {
      const when = at + 0.09 + index * 0.07;
      tone(kit, {
        type: 'triangle',
        from: pitch,
        at: when,
        length: 0.22,
        gain: 0.16 * gain,
        detune,
      });
    });
  },
  /**
   * The time is up, or nobody won: two soft bell strikes, G5 then C6, each a sine with a quiet
   * octave above, ringing out; about 0.6 s, so it reads as "that's it" and never as a hit.
   */
  endBell(kit, at, { gain }) {
    [G5, C6].forEach((pitch, index) => {
      const when = at + index * 0.16;
      tone(kit, { from: pitch, at: when, length: 0.42, gain: 0.32 * gain, detune: 0 });
      tone(kit, { from: pitch * 2, at: when, length: 0.25, gain: 0.08 * gain, detune: 0 });
    });
  },
} satisfies Record<string, Voice>;

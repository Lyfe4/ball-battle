// Balls that hit through the court: a warning you can hear coming, then the strike. The Bomber's
// fuse and boom, the Storm's crackle and thunder, the Quake's rumble, the Inferno's sizzle, the
// Spider's sticky webs, the Banshee's breath and wail, and the Kraken's tentacles rising and crushing.
import { noise, tone } from '../synth.ts';
import { A4, A5, C4, C5, D5, E4, E5, G4, G5, type Voice } from './scale.ts';

export const ZONE_VOICES = {
  /** The Bomber drops a bomb: a heavy "plonk" and a short fuse hiss. */
  bombDrop(kit, at) {
    tone(kit, { from: 260, to: 140, glide: 0.06, at, length: 0.12, gain: 0.3 });
    noise(kit, {
      filter: 'highpass',
      from: 6000,
      at: at + 0.08,
      length: 0.3,
      gain: 0.06,
      attack: 0.05,
    });
  },
  /** A bomb blows: a deep, round boom that rolls on, a puff of debris settling in it. */
  bombBlast(kit, at, { gain }) {
    tone(kit, { from: 80, to: 32, glide: 0.5, at, length: 0.65, gain: 0.55 * (0.7 + 0.3 * gain) });
    noise(kit, {
      filter: 'lowpass',
      from: 900,
      to: 120,
      at,
      length: 0.6,
      gain: 0.4 * (0.6 + 0.4 * gain),
      attack: 0.02,
    });
  },
  /** The Storm calls lightning: a thin crackle rising under the warning. */
  stormWarn(kit, at) {
    noise(kit, {
      filter: 'bandpass',
      from: 1800,
      to: 5200,
      q: 5,
      at,
      length: 0.45,
      gain: 0.08,
      attack: 0.3,
    });
    tone(kit, { from: G5, to: G5 * 1.06, at, length: 0.4, gain: 0.03, attack: 0.3 });
  },
  /** The strike: a bright crack, then a long rumble that rolls in waves (a miss is only the crack). */
  thunder(kit, at, { gain }) {
    noise(kit, { filter: 'highpass', from: 2500, at, length: 0.09, gain: 0.42 });
    for (let roll = 0; roll < 3; roll += 1) {
      noise(kit, {
        filter: 'bandpass',
        from: 260 - roll * 50,
        q: 1.2,
        at: at + 0.06 + roll * 0.16,
        length: 0.3,
        gain: 0.3 * gain * (1 - roll * 0.25),
        attack: 0.05,
      });
    }
  },
  /** The Quake's shockwave leaves a wall: a short rolling rumble, grains of low noise in a row. */
  quake(kit, at, { gain }) {
    for (let grain = 0; grain < 4; grain += 1) {
      noise(kit, {
        filter: 'lowpass',
        from: 420 - grain * 60,
        at: at + grain * 0.045,
        length: 0.07,
        gain: 0.34 * gain * (1 - grain * 0.18),
        attack: 0.01,
      });
    }
  },
  /** A shockwave catches a ball: gravel crunching, three quick grains. */
  quakeHit(kit, at, { gain }) {
    for (let grain = 0; grain < 3; grain += 1) {
      noise(kit, {
        filter: 'bandpass',
        from: 1500 - grain * 250,
        q: 3,
        at: at + grain * 0.035,
        length: 0.04,
        gain: 0.3 * gain,
      });
    }
  },
  /** The Inferno's fire burns a ball: a hiss and pop, like fat in a pan. */
  burn(kit, at, { gain, detune }) {
    noise(kit, {
      filter: 'highpass',
      from: 2800,
      to: 1800,
      at,
      length: 0.14,
      gain: 0.16 * gain,
      attack: 0.01,
    });
    tone(kit, {
      type: 'triangle',
      from: 1300,
      to: 700,
      glide: 0.02,
      at: at + 0.02,
      length: 0.03,
      gain: 0.07,
      detune,
    });
  },
  /** The Spider lays a web: a sticky "thwip", a plucked string sliding up. */
  webLay(kit, at, { gain, detune }) {
    tone(kit, {
      type: 'triangle',
      from: C5,
      to: G5,
      glide: 0.05,
      at,
      length: 0.09,
      gain: 0.1 * gain,
      detune,
    });
    noise(kit, { filter: 'bandpass', from: 3200, q: 3, at, length: 0.04, gain: 0.06 * gain });
  },
  /** A web catches a ball: a stretched twang that sags, and a nip. */
  webCatch(kit, at, { gain }) {
    tone(kit, {
      type: 'triangle',
      from: D5,
      to: D5 * 0.78,
      glide: 0.18,
      at,
      length: 0.24,
      gain: 0.2 * (0.6 + 0.4 * gain),
    });
    tone(kit, { from: D5 * 1.5, to: D5 * 1.17, glide: 0.18, at, length: 0.2, gain: 0.06 });
    noise(kit, { filter: 'bandpass', from: 2000, q: 6, at: at + 0.02, length: 0.02, gain: 0.15 });
  },
  /** The Banshee draws breath: a soft airy inhale, rising into the wail. */
  breath(kit, at) {
    noise(kit, {
      filter: 'bandpass',
      from: 700,
      to: 2200,
      q: 2.5,
      at,
      length: 0.5,
      gain: 0.1,
      attack: 0.42,
    });
  },
  /** It wails: a high, hollow cry sliding up and falling away, two voices beating in it. */
  wail(kit, at, { gain }) {
    for (const cents of [0, 32]) {
      tone(kit, {
        from: E5,
        to: A5,
        glide: 0.16,
        at,
        length: 0.75,
        gain: 0.12 * (0.7 + 0.3 * gain),
        attack: 0.05,
        detune: cents,
      });
    }
    tone(kit, { type: 'triangle', from: A4, to: E4, glide: 0.7, at, length: 0.7, gain: 0.08 });
    noise(kit, { filter: 'bandpass', from: 1800, to: 900, q: 6, at, length: 0.6, gain: 0.07 });
  },
  /** The Kraken calls its tentacles: deep bubbles rising under the court. */
  ripple(kit, at) {
    [C4, E4, G4].forEach((pitch, index) => {
      tone(kit, {
        from: pitch / 2,
        to: pitch,
        glide: 0.05,
        at: at + index * 0.08,
        length: 0.07,
        gain: 0.14,
      });
    });
    noise(kit, { filter: 'lowpass', from: 500, at, length: 0.3, gain: 0.07, attack: 0.1 });
  },
  /** They burst up and wrap a ball: a wet slap, then a squelch rising as they tighten. */
  grab(kit, at) {
    noise(kit, { filter: 'bandpass', from: 1500, to: 500, q: 1.4, at, length: 0.1, gain: 0.35 });
    tone(kit, {
      type: 'triangle',
      from: G4 / 2,
      to: G4,
      glide: 0.22,
      at: at + 0.05,
      length: 0.26,
      gain: 0.16,
      attack: 0.05,
    });
  },
  /** They crush it: three quick crunches like a shell giving way, harder for a bigger ball. */
  crush(kit, at, { gain }) {
    [0, 0.045, 0.1].forEach((when, index) => {
      noise(kit, {
        filter: 'bandpass',
        from: 2200 - index * 500,
        q: 2,
        at: at + when,
        length: 0.05,
        gain: 0.42 * (0.6 + 0.4 * gain),
      });
    });
    tone(kit, { type: 'triangle', from: C4, to: G4 / 2, glide: 0.12, at, length: 0.16, gain: 0.2 });
  },
} satisfies Record<string, Voice>;

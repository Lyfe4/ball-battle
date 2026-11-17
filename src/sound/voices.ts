// Every sound in the game, made in code (Sticker Pop in sound): round, bright and short. Sines and
// soft triangles for the body, a click or a breath of filtered noise for the edge, pitches from one
// major pentatonic scale on C so any two sounds that meet still agree. Nothing is harsh: square and
// sawtooth waves always go through a low-pass, and nothing but the series result lasts over a
// second.
import type { FightCue } from './cues.ts';
import { noise, tone, type Kit } from './synth.ts';

/** The sounds outside a fight: the countdown, the coin, the buttons and the series' end. */
export type UiCue =
  | 'getReady'
  | 'count'
  | 'fight'
  | 'coinFlip'
  | 'coinLand'
  | 'tap'
  | 'lock'
  | 'seriesWin'
  | 'seriesLoss';

export type SoundName = FightCue | UiCue;

/** How one sound is played: its level (0-1) and a little detune (cents) for variety. */
export interface Play {
  readonly gain: number;
  readonly detune: number;
}

type Voice = (kit: Kit, at: number, play: Play) => void;

// C major pentatonic, Hz.
const C4 = 261.63;
const E4 = 329.63;
const G4 = 392;
const A4 = 440;
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880;
const C6 = 1046.5;
const E6 = 1318.5;

export const VOICES: Readonly<Record<SoundName, Voice>> = {
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
  /** The Slime splits: a wet splat and two bloops gliding apart, one up and one down. */
  split(kit, at) {
    noise(kit, { filter: 'lowpass', from: 1800, to: 250, at, length: 0.14, gain: 0.35 });
    tone(kit, { from: G4, to: C5 * 1.5, glide: 0.16, at: at + 0.03, length: 0.2, gain: 0.3 });
    tone(kit, { from: G4, to: C4 * 0.75, glide: 0.16, at: at + 0.03, length: 0.2, gain: 0.3 });
  },

  /** "Get ready": two soft notes rising, a question. */
  getReady(kit, at) {
    tone(kit, { type: 'triangle', from: G4, at, length: 0.18, gain: 0.22, attack: 0.01 });
    tone(kit, { type: 'triangle', from: C5, at: at + 0.12, length: 0.3, gain: 0.22, attack: 0.01 });
  },
  /** 3, 2, 1: a woodblock tick, the same each time. */
  count(kit, at) {
    tone(kit, { from: A5, to: A4, glide: 0.05, at, length: 0.12, gain: 0.4 });
    noise(kit, { filter: 'bandpass', from: 2600, q: 5, at, length: 0.02, gain: 0.2 });
  },
  /** Fight!: a bright chord with a whoosh rising under it. */
  fight(kit, at) {
    noise(kit, {
      filter: 'bandpass',
      from: 600,
      to: 4000,
      q: 1.2,
      at,
      length: 0.3,
      gain: 0.22,
      attack: 0.12,
    });
    [C5, E5, G5, C6].forEach((pitch, index) => {
      tone(kit, {
        type: 'triangle',
        from: pitch,
        at: at + 0.13 + index * 0.012,
        length: 0.42,
        gain: 0.15,
      });
    });
  },
  /** The coin goes up: a metal ting, then a flutter that slows as it turns. */
  coinFlip(kit, at) {
    tone(kit, { from: 2600, at, length: 0.25, gain: 0.12 });
    tone(kit, { from: 3900, at, length: 0.18, gain: 0.06 });
    for (let turn = 0; turn < 9; turn += 1) {
      const when = at + 0.15 + turn * 0.12 + turn * turn * 0.012;
      noise(kit, {
        filter: 'bandpass',
        from: 5200,
        q: 6,
        at: when,
        length: 0.025,
        gain: 0.08 * (1 - turn / 10),
      });
    }
  },
  /** The coin lands: a low thud and a ring. */
  coinLand(kit, at) {
    tone(kit, { from: 180, to: 90, at, length: 0.12, gain: 0.4 });
    tone(kit, { from: 2400, at, length: 0.5, gain: 0.1 });
    tone(kit, { from: 3700, at, length: 0.35, gain: 0.05 });
    tone(kit, { type: 'triangle', from: E5, at: at + 0.08, length: 0.3, gain: 0.12 });
  },
  /** A button: barely there, a tiny tick. */
  tap(kit, at) {
    tone(kit, { from: 1500, to: 1000, at, length: 0.035, gain: 0.12 });
  },
  /** A pick locked in: a click and two quick notes up. */
  lock(kit, at) {
    noise(kit, { filter: 'bandpass', from: 2000, q: 3, at, length: 0.02, gain: 0.25 });
    tone(kit, { type: 'triangle', from: E5, at, length: 0.1, gain: 0.25 });
    tone(kit, { type: 'triangle', from: A5, at: at + 0.07, length: 0.22, gain: 0.25 });
  },
  /** The series is yours: a bouncy arpeggio up to a bright chord with a sparkle. */
  seriesWin(kit, at) {
    [C5, E5, G5].forEach((pitch, index) => {
      tone(kit, { type: 'triangle', from: pitch, at: at + index * 0.1, length: 0.2, gain: 0.25 });
    });
    [C5, E5, G5, C6].forEach((pitch) => {
      tone(kit, {
        type: 'triangle',
        from: pitch,
        at: at + 0.32,
        length: 0.9,
        gain: 0.13,
        attack: 0.01,
      });
    });
    [E6, C6 * 1.5, E6 * 1.5].forEach((pitch, index) => {
      tone(kit, { from: pitch, at: at + 0.4 + index * 0.08, length: 0.3, gain: 0.05 });
    });
  },
  /** The series is theirs: three soft notes falling, gentle rather than sad. */
  seriesLoss(kit, at) {
    [G4, E4, C4].forEach((pitch, index) => {
      tone(kit, {
        type: 'triangle',
        from: pitch,
        to: pitch * 0.985,
        at: at + index * 0.16,
        length: index === 2 ? 0.6 : 0.22,
        gain: 0.24,
        attack: 0.01,
      });
    });
  },
};

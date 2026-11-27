// The sounds outside a fight: the countdown, the coin, the few buttons that tap, a pick locking in
// and the series' end.
import { noise, tone } from '../synth.ts';
import { A4, A5, C4, C5, C6, E4, E5, E6, E7, G4, G5, G6, type Voice } from './scale.ts';

export const UI_VOICES = {
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
  /** A key moment's button (Play, Send challenge, Accept, Rematch): barely there, a tiny tick. */
  tap(kit, at) {
    tone(kit, { from: 1500, to: 1000, at, length: 0.035, gain: 0.12 });
  },
  /** Any other control (a button, a switch, a tab, a chip): a softer, rounder tick, half as loud. */
  press(kit, at, { gain, detune }) {
    tone(kit, { from: E6, to: C6, at, length: 0.03, gain: 0.06 * gain, detune });
  },
  /** Back and Close: the same tick stepping down, a way out. */
  back(kit, at, { gain, detune }) {
    tone(kit, { from: C6, to: G5, at, length: 0.04, gain: 0.06 * gain, detune });
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
    [E6, G6, E7].forEach((pitch, index) => {
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
} satisfies Record<string, Voice>;

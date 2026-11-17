// The notes every sound is pitched on: C major pentatonic, Hz, so any two sounds that meet still
// agree. With the kit (synth.ts) and the shape of a voice, all a voice file needs.
import type { Kit } from '../synth.ts';

export const C3 = 130.81;
export const G3 = 196;
export const A3 = 220;
export const C4 = 261.63;
export const D4 = 293.66;
export const E4 = 329.63;
export const G4 = 392;
export const A4 = 440;
export const C5 = 523.25;
export const D5 = 587.33;
export const E5 = 659.25;
export const G5 = 783.99;
export const A5 = 880;
export const C6 = 1046.5;
export const D6 = 1174.66;
export const E6 = 1318.5;
export const G6 = 1567.98;

/** How one sound is played: its level (0-1) and a little detune (cents) for variety. */
export interface Play {
  readonly gain: number;
  readonly detune: number;
}

export type Voice = (kit: Kit, at: number, play: Play) => void;

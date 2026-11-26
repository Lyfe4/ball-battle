// The game's sound, installed once by main.ts (like the settings menu). Anything may ask for a sound
// by name; before install, with sound off, or before the first tap, nothing plays. A fight's ticks
// are heard through `fightTick`, which reads the arena's events (cues.ts) and lets through only what
// the gate allows on real time, so 2x speed and streams of small hits stay calm.
import { gainOf, loadSound, saveSound, type SoundSettings } from '../app/sound-settings.ts';
import type { SimEvent, WorldState } from '../sim/types.ts';
import { BALL_SOUNDS } from './ball-sounds.ts';
import { cuesOf, type Cue, type FightCue } from './cues.ts';
import { createSoundEngine, type SoundEngine } from './engine.ts';
import { createGate } from './gate.ts';
import { FIGHT_RULES, MENU_RULES } from './rules.ts';
import { PRESSABLE } from '../ui/press.ts';
import type { Play, SoundName, UiCue } from './voices.ts';

/** Cents each repeat is moved by in turn, so a run of the same sound never sounds copied. */
const VARIETY = [0, 35, -25, 55, -45, 15];

/**
 * What a control says when pressed, by its `data-sound`: the key moments (Play, Send challenge,
 * Accept, Rematch) `tap`, as they always have; Back and Close `back`; a control that makes a sound
 * of its own (a pick locking in, Fight!, Hear it, the sound switch) `own`, so a tap is one sound;
 * every other control a soft `press`, half as loud as a key moment's tap.
 */
export type PressSound = 'tap' | 'back' | 'press' | undefined;

/** The sound a click on `target` makes, if any: none for a disabled or busy control. */
export function pressSoundOf(target: EventTarget | null): PressSound {
  if (!(target instanceof Element)) return undefined;
  const control = target.closest<HTMLElement>(PRESSABLE);
  if (control === null) return undefined;
  if (control instanceof HTMLButtonElement && control.disabled) return undefined;
  if (control.getAttribute('aria-disabled') === 'true') return undefined;
  if (control.getAttribute('aria-busy') === 'true') return undefined;
  const sound = control.dataset['sound'];
  if (sound === 'own') return undefined;
  return sound === 'tap' || sound === 'back' ? sound : 'press';
}

interface Installed {
  readonly engine: SoundEngine;
  readonly storage: () => Storage;
  settings: SoundSettings;
}

let installed: Installed | undefined;
const gate = createGate(FIGHT_RULES);
const menuGate = createGate(MENU_RULES);
let turn = 0;

const nextDetune = (): number => {
  turn = (turn + 1) % VARIETY.length;
  return VARIETY[turn] ?? 0;
};

/**
 * Starts sound for the page, with the remembered choice. Controls sound from now on: a click (a tap,
 * a mouse, or Enter or Space on a focused control) is heard once, before its handler runs. Only a
 * person's click: a page passing a click on, or the home demo, makes none.
 */
export function installSound(storage: () => Storage): void {
  const settings = loadSound(storage);
  installed = { engine: createSoundEngine(gainOf(settings)), storage, settings };
  document.addEventListener(
    'click',
    (event) => {
      const sound = pressSoundOf(event.target);
      // Key moments too (ADR 0070): a person's click only, through the gate, so a click passed on
      // or a double tap on Play is one sound.
      if (sound !== undefined && event.isTrusted) menuCue(sound);
    },
    { capture: true },
  );
}

/** A control's soft tick, through its own gate: one per tap, quieter in a quick run. */
function menuCue(name: 'tap' | 'press' | 'back'): void {
  if (installed?.settings.on !== true) return;
  const [share = 0] = menuGate.pass([{ kind: name, strength: 1 }], performance.now());
  if (share > 0) installed.engine.play(name, { gain: share, detune: nextDetune() });
}

export function soundSettings(): SoundSettings | undefined {
  return installed?.settings;
}

export function setSoundSettings(next: SoundSettings): void {
  if (installed === undefined) return;
  installed.settings = next;
  installed.engine.setVolume(gainOf(next));
  saveSound(installed.storage, next);
}

/** A sound outside a fight (the countdown, the coin, a pick, the series' end). */
export function cue(name: UiCue): void {
  if (installed?.settings.on !== true) return;
  installed.engine.play(name, { gain: 1, detune: 0 });
}

/**
 * The sound board: any sound by name at `strength`, through the same gate a fight uses
 * for fight sounds, so a burst there sounds as a burst in a fight would.
 */
export function boardPlay(name: SoundName, strength = 1): void {
  if (installed?.settings.on !== true) return;
  if (!(name in FIGHT_RULES)) {
    installed.engine.play(name, { gain: 1, detune: 0 });
    return;
  }
  const kind = name as FightCue;
  const [share = 0] = gate.pass([{ kind, strength }], performance.now());
  if (share > 0) {
    installed.engine.play(kind, { gain: share * (0.45 + 0.55 * strength), detune: nextDetune() });
  }
}

/** Fight sounds chosen during a frame, made after it (`flush`). */
interface Pending {
  readonly name: FightCue;
  readonly play: Play;
  readonly pan: number;
}
let pending: Pending[] = [];
let flushing = false;

/**
 * Makes the frame's sounds once the frame is done: a timer runs after the browser has drawn, so
 * building audio nodes never lengthens a frame (iPhone Low Power Mode gives each 33 ms, ADR 0063).
 * Each sound is scheduled a few ms ahead on the audio clock anyway (engine.ts), so the wait is
 * not heard.
 */
function flush(): void {
  flushing = false;
  const due = pending;
  pending = [];
  for (const one of due) installed?.engine.play(one.name, one.play, one.pan);
}

/**
 * One tick of a fight on screen, at real time `nowMs`: which sounds it makes, through the gate.
 * Pure reading and a little arithmetic here; the sounds themselves are made after the frame.
 */
export function fightTick(
  events: readonly SimEvent[],
  previous: WorldState,
  world: WorldState,
  nowMs: number,
): void {
  if (installed?.settings.on !== true || !installed.engine.ready()) return;
  const cues = cuesOf(events, previous, world);
  if (cues.length === 0) return;
  const gains = gate.pass(cues, nowMs);
  cues.forEach((one, index) => {
    const share = gains[index] ?? 0;
    if (share <= 0) return;
    // Light hits are still heard: strength sets the level from 45% up.
    const gain = share * (0.45 + 0.55 * one.strength);
    pending.push({ name: one.kind, play: { gain, detune: nextDetune() }, pan: one.pan });
  });
  if (pending.length > 0 && !flushing) {
    flushing = true;
    setTimeout(flush, 0);
  }
}

/** The sound board: one tick's cues of a fight played as sound alone, through the fight's gate. */
export function boardCues(cues: readonly Cue[]): void {
  if (installed?.settings.on !== true) return;
  const gains = gate.pass(cues, performance.now());
  cues.forEach((one, index) => {
    const share = gains[index] ?? 0;
    if (share > 0) {
      const play = { gain: share * (0.45 + 0.55 * one.strength), detune: nextDetune() };
      installed?.engine.play(one.kind, play, one.pan);
    }
  });
}

/** Time between a ball's sounds when the manual plays them. */
const HEAR_GAP_MS = 550;

/** Whether a sound played now would be heard: installed, on, and audio running (after a tap). */
export function soundReady(): boolean {
  return installed?.settings.on === true && installed.engine.ready();
}

/** Whether sound is on: the manual offers "Hear it" only then. */
export function soundOn(): boolean {
  return installed?.settings.on === true;
}

/**
 * A ball's own sounds, one after another, as its manual page plays them (ball-sounds.ts): what its
 * ability sounds like in a fight, at full strength.
 */
export function hearBall(id: string): void {
  if (installed?.settings.on !== true) return;
  (BALL_SOUNDS[id] ?? []).forEach((name, index) => {
    setTimeout(() => {
      installed?.engine.play(name, { gain: 0.9, detune: 0 });
    }, index * HEAR_GAP_MS);
  });
}

/** A new match on screen: the gate starts over. */
export function fightReset(): void {
  gate.reset();
  pending = [];
}

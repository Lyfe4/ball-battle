// The game's sound, installed once by main.ts (like the settings menu). Anything may ask for a sound
// by name; before install, with sound off, or before the first tap, nothing plays. A fight's ticks
// are heard through `fightTick`, which reads the arena's events (cues.ts) and lets through only what
// the gate allows on real time, so 2x speed and streams of small hits stay calm.
import { gainOf, loadSound, saveSound, type SoundSettings } from '../app/sound-settings.ts';
import type { SimEvent, WorldState } from '../sim/types.ts';
import { cuesOf, type FightCue } from './cues.ts';
import { createSoundEngine, type SoundEngine } from './engine.ts';
import { createGate } from './gate.ts';
import { FIGHT_RULES } from './rules.ts';
import type { SoundName, UiCue } from './voices.ts';

/** Cents each repeat is moved by in turn, so a run of the same sound never sounds copied. */
const VARIETY = [0, 35, -25, 55, -45, 15];

/** A button or pick doesn't tap twice when it already has a sound of its own. */
const QUIET_PRESS = '[data-sound-own]';

interface Installed {
  readonly engine: SoundEngine;
  readonly storage: () => Storage;
  settings: SoundSettings;
}

let installed: Installed | undefined;
const gate = createGate(FIGHT_RULES);
let turn = 0;

const nextDetune = (): number => {
  turn = (turn + 1) % VARIETY.length;
  return VARIETY[turn] ?? 0;
};

/** Starts sound for the page, with the remembered choice. Buttons tap from now on. */
export function installSound(storage: () => Storage): void {
  const settings = loadSound(storage);
  installed = { engine: createSoundEngine(gainOf(settings)), storage, settings };
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const press = target.closest('button, a.button, [role="switch"]');
      if (press?.closest(QUIET_PRESS) !== null) return;
      if (press instanceof HTMLButtonElement && press.disabled) return;
      cue('tap');
    },
    { capture: true },
  );
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
 * The sound board (prototype): any sound by name at `strength`, through the same gate a fight uses
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

/** One tick of a fight on screen, at real time `nowMs`. */
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
    installed?.engine.play(one.kind, { gain, detune: nextDetune() }, one.pan);
  });
}

/** A new match on screen: the gate starts over. */
export function fightReset(): void {
  gate.reset();
}

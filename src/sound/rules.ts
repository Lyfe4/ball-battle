// How often each fight sound may repeat (gate.ts), kept apart from the audio code so the density
// measurement (scripts/sound-density.ts) runs in Node. A gap is the shortest real time between two
// plays of a sound; a run is how soon after the last a play counts as a repeat, each quieter. The
// streams that come several times a second (a burn, a poison drip, a web, rage, a shockwave) have
// the longest gaps, so they are heard as a rhythm under the hits, never a buzz (ADR 0064).
import type { FightCue } from './cue-names.ts';
import type { GateRule } from './gate.ts';

/**
 * A control's soft tick (sound.ts): one per tap even if a click is passed on to a second control,
 * and a run of quick taps through a menu gets quieter rather than tiring.
 */
const MENU: GateRule = { gapMs: 60, runMs: 600 };
export const MENU_RULES = { tap: MENU, press: MENU, back: MENU } as const satisfies Record<
  string,
  GateRule
>;

/** A hit: close repeats allowed, each quieter. */
const HIT: GateRule = { gapMs: 70, runMs: 300 };
/** A moment that happens once in a while: never twice in quick succession. */
const MOMENT: GateRule = { gapMs: 150, runMs: 0 };
/** A stream several times a second: spaced out and softened. */
const STREAM: GateRule = { gapMs: 220, runMs: 900 };

export const FIGHT_RULES: Readonly<Record<FightCue, GateRule>> = {
  bump: { gapMs: 70, runMs: 250 },
  hit: HIT,
  // The match's biggest moment is never lost to a busy mix (gate.ts `always`).
  knockout: { gapMs: 0, runMs: 0, always: true },
  // A match that ends without a winner's pop (the time limit, a draw) is never silent either.
  endBell: { gapMs: 0, runMs: 0, always: true },
  arrowFire: { gapMs: 120, runMs: 400 },
  arrowHit: HIT,
  boomThrow: MOMENT,
  boomHit: HIT,
  boomBack: HIT,
  boomCatch: MOMENT,
  lockOn: MOMENT,
  snipe: MOMENT,
  snipeHit: { gapMs: 100, runMs: 0 },
  shieldUp: MOMENT,
  glance: HIT,
  spear: MOMENT,
  spearHit: { gapMs: 100, runMs: 0 },
  raise: MOMENT,
  bite: HIT,
  boneBreak: MOMENT,
  bombDrop: MOMENT,
  bombBlast: { gapMs: 100, runMs: 0 },
  stormWarn: MOMENT,
  thunder: { gapMs: 100, runMs: 0 },
  quake: STREAM,
  quakeHit: { gapMs: 150, runMs: 600 },
  burn: STREAM,
  webLay: STREAM,
  webCatch: HIT,
  breath: MOMENT,
  wail: { gapMs: 100, runMs: 0 },
  ripple: MOMENT,
  grab: { gapMs: 100, runMs: 0 },
  crush: { gapMs: 100, runMs: 0 },
  rage: STREAM,
  rageHit: { gapMs: 100, runMs: 0 },
  speedHit: { gapMs: 100, runMs: 0 },
  grow: MOMENT,
  thorns: HIT,
  phaseIn: MOMENT,
  ghostPass: { gapMs: 120, runMs: 0 },
  pull: { gapMs: 300, runMs: 0 },
  squeak: { gapMs: 70, runMs: 250 },
  squash: HIT,
  pop: { gapMs: 100, runMs: 0 },
  shimmer: MOMENT,
  copyPop: { gapMs: 100, runMs: 0 },
  charge: MOMENT,
  splinter: { gapMs: 100, runMs: 0 },
  spark: { gapMs: 70, runMs: 250 },
  frost: { gapMs: 120, runMs: 400 },
  poison: { gapMs: 120, runMs: 400 },
  poisonTick: STREAM,
  drain: HIT,
  bloomOpen: MOMENT,
  bloomShut: { gapMs: 250, runMs: 0 },
  rewind: { gapMs: 0, runMs: 0 },
  store: { gapMs: 120, runMs: 0 },
  release: { gapMs: 100, runMs: 0 },
  curse: { gapMs: 200, runMs: 0 },
  curseBurst: { gapMs: 100, runMs: 0 },
  split: { gapMs: 100, runMs: 0 },
};

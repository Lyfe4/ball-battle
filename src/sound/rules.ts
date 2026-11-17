// How often each fight sound may repeat (gate.ts), kept apart from the audio code so the density
// measurement (scripts/sound-density.ts) runs in Node.
import type { FightCue } from './cues.ts';
import type { GateRule } from './gate.ts';

/** How often each fight sound may repeat (gate.ts). */
export const FIGHT_RULES: Readonly<Record<FightCue, GateRule>> = {
  bump: { gapMs: 70, runMs: 250 },
  hit: { gapMs: 70, runMs: 300 },
  knockout: { gapMs: 0, runMs: 0 },
  arrowFire: { gapMs: 120, runMs: 400 },
  arrowHit: { gapMs: 70, runMs: 300 },
  curse: { gapMs: 200, runMs: 0 },
  curseBurst: { gapMs: 100, runMs: 0 },
  store: { gapMs: 120, runMs: 0 },
  release: { gapMs: 100, runMs: 0 },
  split: { gapMs: 100, runMs: 0 },
};

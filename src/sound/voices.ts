// Every sound in the game, made in code (Sticker Pop in sound, ADR 0064): round, bright and short.
// Sines and soft triangles for the body, a click or a breath of filtered noise for the edge,
// pitches from one major pentatonic scale on C (voices/scale.ts) so any two sounds that meet still
// agree. Nothing is harsh: square and sawtooth waves always go through a low-pass, and nothing but
// the series result lasts over a second. Each ball with an ability has sounds of its own that say
// what kind of hit it is (voices/shots.ts, zones.ts, body.ts, tricks.ts, life.ts); the Brawler has
// only the shared bump.
import { BODY_VOICES } from './voices/body.ts';
import { LIFE_VOICES } from './voices/life.ts';
import type { FightCue } from './cue-names.ts';
import type { Voice } from './voices/scale.ts';
import { SHARED_VOICES } from './voices/shared.ts';
import { SHOT_VOICES } from './voices/shots.ts';
import { TRICK_VOICES } from './voices/tricks.ts';
import { UI_VOICES } from './voices/ui.ts';
import { ZONE_VOICES } from './voices/zones.ts';

export type { Play, Voice } from './voices/scale.ts';

/** One voice for every fight cue (cue-names.ts), and no other. */
const FIGHT_VOICES: Readonly<Record<FightCue, Voice>> = {
  ...SHARED_VOICES,
  ...SHOT_VOICES,
  ...ZONE_VOICES,
  ...BODY_VOICES,
  ...TRICK_VOICES,
  ...LIFE_VOICES,
} satisfies Record<FightCue, Voice>;

export type { FightCue };
/** The sounds outside a fight: the countdown, the coin, the few buttons that tap, the series' end. */
export type UiCue = keyof typeof UI_VOICES;
export type SoundName = FightCue | UiCue;

export const VOICES: Readonly<Record<SoundName, Voice>> = { ...FIGHT_VOICES, ...UI_VOICES };

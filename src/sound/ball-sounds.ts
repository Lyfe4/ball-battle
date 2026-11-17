// Which sounds are each ball's own, in the order its ability makes them: the manual's "Hear it"
// plays them in turn, and tests check every one is heard in a real fight and that no two balls
// share one (ADR 0064). The Brawler has no ability: it says only the shared bump.
import type { FightCue } from './cue-names.ts';

export const BALL_SOUNDS: Readonly<Record<string, readonly FightCue[]>> = {
  archer: ['arrowFire', 'arrowHit'],
  battery: ['store', 'release'],
  berserker: ['rage', 'rageHit'],
  bloom: ['bloomOpen', 'bloomShut'],
  bomber: ['bombDrop', 'bombBlast'],
  boomerang: ['boomThrow', 'boomHit', 'boomBack', 'boomCatch'],
  brawler: ['bump'],
  chrono: ['rewind'],
  frost: ['frost'],
  ghost: ['phaseIn', 'ghostPass'],
  hex: ['curse', 'curseBurst'],
  inferno: ['burn'],
  magnet: ['pull'],
  necromancer: ['raise', 'bite', 'boneBreak'],
  quake: ['quake', 'quakeHit'],
  slime: ['split'],
  sniper: ['lockOn', 'snipe', 'snipeHit'],
  spartan: ['shieldUp', 'glance', 'spear', 'spearHit'],
  speedster: ['speedHit'],
  spider: ['webLay', 'webCatch'],
  storm: ['stormWarn', 'thunder'],
  thorns: ['thorns'],
  titan: ['grow'],
  vampire: ['drain'],
  venom: ['poison', 'poisonTick'],
};

/** The sounds every ball makes. */
export const SHARED_SOUNDS: readonly FightCue[] = ['bump', 'hit', 'knockout'];

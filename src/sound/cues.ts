// What a tick sounds like, read from its events and the worlds either side of it, the way the
// effects read them (ADR 0007, 0064): pure, and only ever about something the arena draws. The sim
// never knows sound exists. Events say most of it (this file); a few moments are only a change in
// a ball's ability state between the two worlds (state-cues.ts). A ball's own sound takes the place
// of the bump when its ability is the bump (a Battery's release, a Berserker's rage, a Speedster's
// boosted hit, a Ghost passing through, the Balloon's squeak), and plays beside it otherwise (Thorns' spikes, a
// Vampire's sip, Frost and Venom landing).
import { impactStrength } from '../render/impact.ts';
import { ARENA_SIZE } from '../sim/constants.ts';
import { CAPACITY } from '../sim/balls/battery.ts';
import { rageOf } from '../sim/balls/berserker.ts';
import { stacksOf } from '../sim/balls/speedster.ts';
import type { BallState, SimEvent, Vec2, WorldState } from '../sim/types.ts';
import { stateCues } from './state-cues.ts';
import type { FightCue } from './cue-names.ts';

export type { FightCue };

export interface Cue {
  readonly kind: FightCue;
  /** 0 (lightest) to 1 (hardest). */
  readonly strength: number;
  /** Left -1 to right 1, from where it happened; kept narrow so a phone speaker still hears it. */
  readonly pan: number;
}

/** Adds a cue: what, how strong, and where (for panning). */
export type AddCue = (kind: FightCue, strength: number, point?: Vec2) => void;

/** How far a sound moves to one side at the arena's edge. */
const PAN_WIDTH = 0.5;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const panAt = (point: Vec2 | undefined): number =>
  point === undefined ? 0 : ((point.x - ARENA_SIZE / 2) / (ARENA_SIZE / 2)) * PAN_WIDTH;

const byId = (world: WorldState): ReadonlyMap<string, BallState> =>
  new Map(world.balls.map((ball) => [ball.id, ball]));

const stored = (ball: BallState | undefined): number => {
  const value = ball?.abilityState['stored'];
  return typeof value === 'number' ? value : 0;
};

/** Each shooter's own shot and hit; any other projectile is heard through the shared hit. */
const SHOTS: Readonly<Record<string, readonly [FightCue, FightCue]>> = {
  archer: ['arrowFire', 'arrowHit'],
  boomerang: ['boomThrow', 'boomHit'],
  sniper: ['snipe', 'snipeHit'],
  spartan: ['spear', 'spearHit'],
};

/** Ability damage that is a ball's own moment, by its definition and what delivered it. */
const ABILITY_DAMAGE: Readonly<Record<string, FightCue>> = {
  'hex/onTick': 'curseBurst',
  'spider/onTick': 'webCatch',
  'venom/poison': 'poisonTick',
  'inferno/zonePulse': 'burn',
  'thorns/onDamageTaken': 'thorns',
  'kraken/onTick': 'crush',
};

/** Damage that size, as a share of a hard hit, for ability damage measured in its own units. */
const share = (amount: number, full: number): number => amount / full;

/** The sounds of one tick, in event order (then the state changes). */
export function cuesOf(
  events: readonly SimEvent[],
  previous: WorldState,
  world: WorldState,
): readonly Cue[] {
  const before = byId(previous);
  const after = byId(world);
  const kindOf = (id: string): string | undefined =>
    (after.get(id) ?? before.get(id))?.definitionId;
  const cues: Cue[] = [];
  const add: AddCue = (kind, strength, point) => {
    cues.push({ kind, strength: clamp01(strength), pan: panAt(point) });
  };
  // Contact damage per ball this tick: how hard a bump sounds.
  const contact = new Map<string, number>();
  // Balls whose bump this tick is their ability: a Berserker letting its rage out, a Speedster's
  // boosted hit, a Ghost's hit from inside.
  const ownBump = new Map<string, FightCue>();
  for (const event of events) {
    if (event.type === 'damage' && event.cause === 'contact') {
      contact.set(event.targetId, (contact.get(event.targetId) ?? 0) + event.amount);
    }
    if (event.type === 'abilityTriggered' && event.hook === 'onHitBall') {
      if (kindOf(event.ballId) === 'berserker') ownBump.set(event.ballId, 'rageHit');
    }
    if (event.type === 'damage' && event.via === 'onHitBall') {
      if (kindOf(event.sourceId) === 'speedster') ownBump.set(event.sourceId, 'speedHit');
    }
  }
  const ended = events.some((event) => event.type === 'matchEnded');

  for (const event of events) {
    switch (event.type) {
      case 'collision': {
        const ghost = event.ballIds.find((id) => kindOf(id) === 'ghost');
        if (event.phased === true) {
          if (ghost !== undefined) add('ghostPass', 1, event.point);
          break;
        }
        // A Battery that had stored a hit lets it out on this bump: that is the sound.
        const battery = event.ballIds.find(
          (id) => kindOf(id) === 'battery' && stored(before.get(id)) > stored(after.get(id)),
        );
        if (battery !== undefined) {
          add('release', stored(before.get(battery)) / CAPACITY, event.point);
          break;
        }
        const own = event.ballIds.find((id) => ownBump.has(id));
        if (own !== undefined) {
          const ball = before.get(own);
          const kind = ownBump.get(own) ?? 'bump';
          const strength =
            kind === 'rageHit'
              ? rageOf(ball?.abilityState ?? {}) / 3
              : ball === undefined
                ? 0.5
                : stacksOf(ball) / 5;
          add(kind, strength, event.point);
          break;
        }
        const damage = Math.max(...event.ballIds.map((id) => contact.get(id) ?? 0));
        // The Balloon's own rubber says every bump it is in.
        const rubber = event.ballIds.some((id) => kindOf(id) === 'balloon');
        add(rubber ? 'squeak' : 'bump', impactStrength(damage), event.point);
        break;
      }
      case 'projectileFired': {
        const shot = SHOTS[kindOf(event.ownerId) ?? ''];
        if (shot !== undefined) add(shot[0], 0.5, event.position);
        break;
      }
      case 'projectileHit': {
        const owner = kindOf(event.ownerId);
        const shot = SHOTS[owner ?? ''];
        let kind: FightCue = shot?.[1] ?? 'hit';
        if (owner === 'boomerang' && isComingBack(previous, world, event.projectileId)) {
          kind = 'boomBack';
        }
        add(kind, impactStrength(event.amount), event.point);
        break;
      }
      case 'projectileExpired':
        if (event.reason === 'caught' && kindOf(event.ownerId) === 'boomerang') {
          add('boomCatch', 0.5, after.get(event.ownerId)?.position);
        }
        break;
      case 'zoneSpawned':
        zoneSpawned(kindOf(event.ownerId), event.position, add);
        break;
      case 'zoneStruck':
        zoneStruck(kindOf(event.ownerId), event.position, event.hitIds.length, add);
        break;
      case 'damage': {
        if (event.cause !== 'ability') break;
        const kind = ABILITY_DAMAGE[`${kindOf(event.sourceId) ?? ''}/${event.via ?? ''}`];
        if (kind !== undefined) {
          add(kind, share(event.amount, 12), after.get(event.targetId)?.position);
        }
        // A shot its defence made hit harder: the Balloon pops beside the shot's own hit.
        if (event.via === 'projectile' && (event.raised ?? 0) > 0) {
          add('pop', share(event.amount, 12), after.get(event.targetId)?.position);
        }
        break;
      }
      case 'healed':
        if (kindOf(event.ballId) === 'vampire') {
          add('drain', share(event.amount, 39), after.get(event.ballId)?.position);
        }
        break;
      case 'hitReduced': {
        const kind = kindOf(event.ballId);
        const at = after.get(event.ballId)?.position;
        if (kind === 'battery') add('store', event.reduced / CAPACITY, at);
        if (kind === 'spartan') add('glance', event.reduced / (event.reduced + event.rest), at);
        if (kind === 'balloon') add('squash', share(event.reduced, 12), at);
        break;
      }
      case 'statusApplied': {
        const at = after.get(event.ballId)?.position;
        const source = kindOf(event.sourceId);
        if (event.status === 'slowed' && source === 'frost') add('frost', 0.6, at);
        if (event.status === 'poisoned' && source === 'venom') add('poison', 0.6, at);
        if (event.status === 'held' && source === 'kraken') add('grab', 0.6, at);
        break;
      }
      case 'rewound':
        add('rewind', share(event.healthAfter - event.healthBefore, 62), event.to);
        break;
      case 'split':
        add('split', 1, event.position);
        break;
      case 'minionSpawned':
        if (kindOf(event.ownerId) === 'necromancer') add('raise', 0.6, event.position);
        break;
      case 'minionHit':
        if (kindOf(event.ownerId) === 'necromancer')
          add('bite', share(event.amount, 11), event.point);
        break;
      case 'minionDestroyed':
        if (kindOf(event.ownerId) === 'necromancer') add('boneBreak', 0.6, event.position);
        break;
      case 'ballDefeated':
        add('knockout', ended ? 1 : 0.6, before.get(event.ballId)?.position);
        break;
      default:
        break;
    }
  }
  stateCues(events, previous, world, add);
  return cues;
}

/**
 * True when a Boomerang's projectile hit on its way back (as the sim decides it, returning.ts):
 * read from the world before the tick, since a wall later in the same tick turns it after the hit.
 */
function isComingBack(previous: WorldState, world: WorldState, id: string): boolean {
  const shot = previous.projectiles.find((candidate) => candidate.id === id);
  const returning = shot?.returning;
  return returning !== undefined && (returning.back || world.tick >= returning.turnTick);
}

/** A warning or a drop: the Bomber's bomb, the Storm's mark, the Quake's wave leaving a wall. */
function zoneSpawned(owner: string | undefined, at: Vec2, add: AddCue): void {
  if (owner === 'bomber') add('bombDrop', 0.6, at);
  else if (owner === 'storm') add('stormWarn', 0.6, at);
  else if (owner === 'quake') add('quake', 0.5, at);
  // The Inferno lays a patch every 26 ticks: heard only when it burns.
}

/** A strike: a bomb's boom, the thunder (only its crack on a miss), a shockwave that catches. */
function zoneStruck(owner: string | undefined, at: Vec2, hits: number, add: AddCue): void {
  if (owner === 'bomber') add('bombBlast', hits > 0 ? 1 : 0.5, at);
  else if (owner === 'storm') add('thunder', hits > 0 ? 1 : 0.2, at);
  else if (owner === 'quake') {
    if (hits > 0) add('quakeHit', 0.6, at);
  } else if (owner !== 'inferno' && hits > 0) add('hit', 0.6, at);
}

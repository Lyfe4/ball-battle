// The moments no event marks: a change in a ball's ability state between the world before a tick
// and after it (ADR 0064). The Hex's curse landing, the Ghost phasing out, the Magnet's pull, the
// Sniper locking on, the Spartan planting its shield, the Spider spinning a web, the Titan growing
// a step, the Berserker's rage building, the Bloom opening or shutting, the Banshee drawing breath
// and wailing, the Kraken calling its tentacles, the Mirage's copy appearing and popping, the
// Jouster setting off on a charge. Pure, like cues.ts.
import { nextWailTickOf } from '../sim/balls/banshee.ts';
import { rageOf } from '../sim/balls/berserker.ts';
import { jousterStateOf } from '../sim/balls/jouster.ts';
import { krakenStateOf } from '../sim/balls/kraken.ts';
import { copyPosition, mirageStateOf } from '../sim/balls/mirage.ts';
import { theme } from '../render/theme.ts';
import { pausedUntilOf } from '../sim/balls/bloom.ts';
import { hexCurseOf } from '../sim/balls/hex.ts';
import { chargeOf } from '../sim/balls/sniper.ts';
import { spartanRaisedOf } from '../sim/balls/spartan.ts';
import { websOf, type Web } from '../sim/balls/spider.ts';
import { MAX_RADIUS } from '../sim/balls/titan.ts';
import { STANDARD_BALL_RADIUS } from '../sim/constants.ts';
import type { BallState, SimEvent, Vec2, WorldState } from '../sim/types.ts';
import type { AddCue } from './cues.ts';

/** The Titan is heard growing in this many steps, from its start to its full size. */
const GROWTH_STEPS = 4;
/** A Bloom heals every this many ticks once it regrows: a heal sooner than this after its pause is its first. */
const BLOOM_HEAL_TICKS = 12;

const stepOf = (radius: number): number =>
  Math.floor(
    ((radius - STANDARD_BALL_RADIUS) / (MAX_RADIUS - STANDARD_BALL_RADIUS)) * GROWTH_STEPS,
  );

/** Where a web sits on its wall. */
function webPoint(web: Web, size: number): Vec2 {
  if (web.side === 0) return { x: 0, y: web.at };
  if (web.side === 1) return { x: size, y: web.at };
  if (web.side === 2) return { x: web.at, y: 0 };
  return { x: web.at, y: size };
}

const numberIn = (ball: BallState, key: string): number | undefined => {
  const value = ball.abilityState[key];
  return typeof value === 'number' ? value : undefined;
};

export function stateCues(
  events: readonly SimEvent[],
  previous: WorldState,
  world: WorldState,
  add: AddCue,
): void {
  const before = new Map(previous.balls.map((ball) => [ball.id, ball]));
  const after = new Map(world.balls.map((ball) => [ball.id, ball]));
  const triggered = (id: string, hook: string): boolean =>
    events.some(
      (event) => event.type === 'abilityTriggered' && event.ballId === id && event.hook === hook,
    );
  const healed = (id: string): boolean =>
    events.some((event) => event.type === 'healed' && event.ballId === id);

  for (const ball of world.balls) {
    const was = before.get(ball.id);
    if (was === undefined || ball.health <= 0) continue;
    const at = ball.position;
    switch (ball.definitionId) {
      case 'hex': {
        // The Hex lays its curse on a bump: heard as the curse appears on the other ball.
        const now = hexCurseOf(ball);
        if (now !== undefined && now.cursedTick !== hexCurseOf(was)?.cursedTick) {
          add('curse', 0.6, after.get(now.cursedId)?.position);
        }
        break;
      }
      case 'ghost':
        // Its rhythm is seeded on its first tick (phase -1 before): not a phase starting.
        if (ball.abilityState['phased'] === true && was.abilityState['phased'] !== true) {
          if (numberIn(was, 'phase') !== -1) add('phaseIn', 0.6, at);
        }
        break;
      case 'magnet':
        // A pull from a ranged hit, else its timed pull starting (its next pull moved on).
        if (triggered(ball.id, 'onDamageTaken')) add('pull', 1, at);
        else if (numberIn(ball, 'nextPullTick') !== numberIn(was, 'nextPullTick')) {
          add('pull', 0.4, at);
        }
        break;
      case 'sniper':
        if (chargeOf(ball) !== undefined && chargeOf(was) === undefined) add('lockOn', 0.6, at);
        break;
      case 'spartan':
        if (spartanRaisedOf(ball) === true && spartanRaisedOf(was) === false) {
          add('shieldUp', 0.6, at);
        }
        break;
      case 'spider': {
        // A corner spins two at once: one sound.
        const spun = (websOf(ball) ?? []).find((web) => web.since === world.tick);
        if (spun !== undefined) add('webLay', 0.5, webPoint(spun, world.arena.size));
        break;
      }
      case 'banshee': {
        // The breath starts as the arena's glow does; the wail is its next wail moving on.
        const next = nextWailTickOf(ball);
        const wasNext = nextWailTickOf(was);
        if (next === undefined || wasNext === undefined) break;
        const breathAt = next - theme.bansheeBreathTicks;
        if (next !== wasNext) add('wail', 1, at);
        else if (previous.tick < breathAt && world.tick >= breathAt) add('breath', 0.6, at);
        break;
      }
      case 'kraken': {
        // Its call: the ripples appear where the tentacles will rise.
        const state = krakenStateOf(ball);
        const wasState = krakenStateOf(was);
        const spot = state?.spots[0];
        if (spot !== undefined && state !== undefined && wasState !== undefined) {
          if (state.burstTick >= 0 && wasState.burstTick < 0) add('ripple', 0.6, spot);
        }
        break;
      }
      case 'mirage': {
        // Heard where the copy hangs: shimmering in, and popping where it burst.
        const state = mirageStateOf(ball);
        const wasOn = mirageStateOf(was)?.copyOn;
        if (state === undefined || wasOn === undefined || state.copyOn === wasOn) break;
        const copy = copyPosition(at, state, world.arena.size);
        add(state.copyOn ? 'shimmer' : 'copyPop', state.copyOn ? 0.5 : 1, copy);
        break;
      }
      case 'jouster': {
        // A charge starting moves its next charge on.
        const next = jousterStateOf(ball)?.nextCharge;
        const wasNext = jousterStateOf(was)?.nextCharge;
        if (next !== undefined && wasNext !== undefined && next !== wasNext) add('charge', 0.6, at);
        break;
      }
      case 'titan':
        if (stepOf(ball.radius) > stepOf(was.radius)) {
          add('grow', stepOf(ball.radius) / GROWTH_STEPS, at);
        }
        break;
      case 'berserker':
        // Rage released on a bump is its own sound (cues.ts); the hit it took then is part of it.
        if (rageOf(ball.abilityState) > rageOf(was.abilityState)) {
          if (!triggered(ball.id, 'onHitBall')) add('rage', rageOf(ball.abilityState) / 3, at);
        }
        break;
      case 'bloom': {
        const until = pausedUntilOf(ball);
        const wasUntil = pausedUntilOf(was);
        if (until !== undefined && wasUntil !== undefined && until > wasUntil) {
          // Only a Bloom that was regrowing shuts; one still waiting just waits longer.
          if (world.tick > wasUntil) add('bloomShut', 0.6, at);
        } else if (
          healed(ball.id) &&
          until !== undefined &&
          world.tick >= until &&
          world.tick - until < BLOOM_HEAL_TICKS
        ) {
          add('bloomOpen', 0.6, at);
        }
        break;
      }
      default:
        break;
    }
  }
}

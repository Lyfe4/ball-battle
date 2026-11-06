import { isAlive, isPhased as phasedOf } from '../combat.ts';
import { getDefinition } from '../definitions.ts';
import { createStream, deriveSeed } from '../rng.ts';
import type {
  Actions,
  BallDefinition,
  BallState,
  DamageEvent,
  DefinitionLookup,
  HookContext,
  HookName,
  SimEvent,
  WorldState,
} from '../types.ts';
import { applyActions, type Scene } from './apply-actions.ts';

/** One hook call to make in a phase: which ball, which hook, and how to call it. */
export interface Invocation {
  readonly ballId: string;
  readonly hook: HookName;
  /** Calls the hook with the base context plus its hook-specific extras, or undefined if absent. */
  readonly call: (
    definition: BallDefinition,
    base: HookContext,
    snapshot: readonly BallState[],
  ) => Actions | undefined;
}

const HOOK_CODES: Readonly<Record<HookName, number>> = {
  onTick: 1,
  onWallHit: 2,
  onHitBall: 3,
  onDamageDealt: 4,
  onDamageTaken: 5,
  onKnockedOut: 6,
};

export interface PhaseResult extends Scene {
  readonly events: readonly SimEvent[];
}

/**
 * Runs one hook phase: every invocation sees the same snapshot of the world (collect), then all
 * returned actions are applied in invocation order, each hook's actions in the order returned
 * (apply). Hooks only run for balls alive at the start of the phase. Each hook call that returned
 * actions emits `abilityTriggered` just before the events its actions produced.
 */
export function runPhase(
  world: WorldState,
  invocations: readonly Invocation[],
  definitions: DefinitionLookup,
): PhaseResult {
  const snapshot = world.balls;
  const collected: {
    readonly ballId: string;
    readonly hook: HookName;
    readonly actions: Actions;
  }[] = [];

  // A ball can get several calls of the same hook in one tick (one per contact or damage event),
  // so each call's random stream also includes how many calls that ball has had this phase.
  const callCounts = new Map<string, number>();
  const isPhased = (ball: BallState): boolean =>
    phasedOf(ball, getDefinition(definitions, ball.definitionId));

  for (const invocation of invocations) {
    const ballIndex = snapshot.findIndex((ball) => ball.id === invocation.ballId);
    const self = snapshot[ballIndex];
    // onKnockedOut is for a ball just brought to 0 (ADR 0034); every other hook needs it alive.
    if (self === undefined || (!isAlive(self) && invocation.hook !== 'onKnockedOut')) continue;
    const definition = getDefinition(definitions, self.definitionId);
    const call = callCounts.get(self.id) ?? 0;
    callCounts.set(self.id, call + 1);
    const random = createStream(
      deriveSeed([world.rngState, world.tick, ballIndex, HOOK_CODES[invocation.hook], call]),
    );
    const base: HookContext = { world, self, stats: definition, random, isPhased };
    const actions = invocation.call(definition, base, snapshot);
    if (actions !== undefined && actions.length > 0) {
      collected.push({ ballId: invocation.ballId, hook: invocation.hook, actions });
    }
  }

  let scene: Scene = {
    balls: snapshot,
    projectiles: world.projectiles,
    nextProjectileId: world.nextProjectileId,
    zones: world.zones,
    nextZoneId: world.nextZoneId,
    minions: world.minions,
    nextMinionId: world.nextMinionId,
  };
  const events: SimEvent[] = [];
  for (const { ballId, hook, actions } of collected) {
    events.push({ type: 'abilityTriggered', tick: world.tick, ballId, hook });
    const result = applyActions(scene, ballId, actions, definitions, world.tick, world.arena.size);
    scene = result;
    events.push(...result.events);
  }
  return {
    balls: scene.balls,
    projectiles: scene.projectiles,
    nextProjectileId: scene.nextProjectileId,
    zones: scene.zones,
    nextZoneId: scene.nextZoneId,
    minions: scene.minions,
    nextMinionId: scene.nextMinionId,
    events,
  };
}

export function tickInvocations(balls: readonly BallState[]): Invocation[] {
  return balls.map((ball) => ({
    ballId: ball.id,
    hook: 'onTick',
    call: (definition, base) => definition.hooks.onTick?.(base),
  }));
}

export function wallHitInvocations(bounces: ReadonlyMap<string, number>): Invocation[] {
  return [...bounces]
    .filter(([, count]) => count > 0)
    .map(([ballId, count]) => ({
      ballId,
      hook: 'onWallHit',
      call: (definition, base) => definition.hooks.onWallHit?.({ ...base, bounces: count }),
    }));
}

/**
 * Both balls of each new contact, in contact order. A pass through a phased ball (ADR 0026) is no
 * hit for the other ball, so only the phased ball's own hook runs: on-touch effects (slow, poison,
 * shock, a Speedster's cash-in) need contact.
 */
export function hitBallInvocations(
  newContacts: readonly {
    readonly ballIds: readonly [string, string];
    readonly phased: boolean;
  }[],
  isPhasedId: (ballId: string) => boolean = () => false,
): Invocation[] {
  return newContacts.flatMap(({ ballIds: [idA, idB], phased }) =>
    (
      [
        [idA, idB],
        [idB, idA],
      ] as const
    )
      .filter(([ballId]) => !phased || isPhasedId(ballId))
      .map(([ballId, otherId]): Invocation => ({
        ballId,
        hook: 'onHitBall',
        call: (definition, base, snapshot) => {
          const other = snapshot.find((ball) => ball.id === otherId);
          return other === undefined ? undefined : definition.hooks.onHitBall?.({ ...base, other });
        },
      })),
  );
}

/** One call per damage event, for the ball that dealt it. */
export function damageDealtInvocations(damage: readonly DamageEvent[]): Invocation[] {
  return damage
    .filter((event) => event.amount > 0)
    .map((event) => ({
      ballId: event.sourceId,
      hook: 'onDamageDealt',
      call: (definition, base, snapshot) => {
        const target = snapshot.find((ball) => ball.id === event.targetId);
        return target === undefined
          ? undefined
          : definition.hooks.onDamageDealt?.({
              ...base,
              target,
              amount: event.amount,
              cause: event.cause,
            });
      },
    }));
}

/** One call per damage event, for the ball that took it (ADR 0012). */
export function damageTakenInvocations(damage: readonly DamageEvent[]): Invocation[] {
  return damage
    .filter((event) => event.amount > 0)
    .map((event) => ({
      ballId: event.targetId,
      hook: 'onDamageTaken',
      call: (definition, base, snapshot) => {
        const attacker = snapshot.find((ball) => ball.id === event.sourceId);
        return attacker === undefined
          ? undefined
          : definition.hooks.onDamageTaken?.({
              ...base,
              attacker,
              amount: event.amount,
              cause: event.cause,
            });
      },
    }));
}

/**
 * One call for each ball that was alive at the start of the tick and is at 0 health now, before it
 * is defeated (ADR 0034).
 */
export function knockedOutInvocations(
  before: readonly BallState[],
  now: readonly BallState[],
): Invocation[] {
  const down = new Set(now.filter((ball) => !isAlive(ball)).map((ball) => ball.id));
  return before
    .filter((ball) => isAlive(ball) && down.has(ball.id))
    .map((ball) => ({
      ballId: ball.id,
      hook: 'onKnockedOut',
      call: (definition, base) => definition.hooks.onKnockedOut?.(base),
    }));
}

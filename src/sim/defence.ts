// What a hit does to the ball it lands on (ADR 0045): a ball whose definition declares
// `incomingDamageOf` (the Spartan's shield, the Ghost's fade) takes less of every hit, whatever
// delivered it (a contact hit, a projectile, a strike, a burn, a skull, a poison tick, a hook's
// damage). One rule in one place for both damage paths: contact damage (combat.ts) and ability
// damage (the `damage` action every other source goes through).
import { getDefinition } from './definitions.ts';
import type { BallState, DefinitionLookup } from './types.ts';

/** A ball's defence took some or all of a hit; any rest lands as a damage event. */
export interface HitReducedEvent {
  readonly type: 'hitReduced';
  readonly tick: number;
  readonly ballId: string;
  /** The ball whose hit it was. */
  readonly sourceId: string;
  /** Health the defence saved. */
  readonly reduced: number;
  /** What was left of the hit (0 when it took it all). */
  readonly rest: number;
}

/**
 * A hit of `amount` on `target` after its definition's `incomingDamageOf`, as a whole number from 0
 * to `amount`, and the event when its defence took anything. A ball without a defence takes the hit
 * whole.
 */
export function defendHit(
  target: BallState,
  sourceId: string,
  amount: number,
  definitions: DefinitionLookup,
  tick: number,
): { readonly rest: number; readonly event: HitReducedEvent | undefined } {
  const { incomingDamageOf } = getDefinition(definitions, target.definitionId);
  if (incomingDamageOf === undefined || amount <= 0) return { rest: amount, event: undefined };
  const defended = incomingDamageOf(target, amount, tick);
  if (!Number.isFinite(defended)) {
    throw new Error(`Ball "${target.id}" defended a hit to a non-finite value`);
  }
  const rest = Math.min(amount, Math.max(0, Math.round(defended)));
  if (rest === amount) return { rest, event: undefined };
  return {
    rest,
    event: { type: 'hitReduced', tick, ballId: target.id, sourceId, reduced: amount - rest, rest },
  };
}

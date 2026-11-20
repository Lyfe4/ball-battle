// What a hit does to the ball it lands on (ADR 0045): a ball whose definition declares
// `incomingDamageOf` (the Spartan's shield, the Ghost's fade) takes less of every hit, whatever
// delivered it (a contact hit, a projectile, a strike, a burn, a skull, a poison tick, a hook's
// damage). One rule in one place for both damage paths: contact damage (combat.ts) and ability
// damage (the `damage` action every other source goes through).
import { getDefinition } from './definitions.ts';
import type { BallState, DamageVia, DefinitionLookup } from './types.ts';

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
 * A hit of `amount` on `target` after its definition's `incomingDamageOf`, as a whole number of 0 or
 * more, and the event when its defence took anything. A defence may also raise a hit (the Balloon's
 * shots, ADR 0075): `raised` is what it added, and no event marks it. A ball without a defence
 * takes the hit whole.
 */
export function defendHit(
  target: BallState,
  sourceId: string,
  amount: number,
  definitions: DefinitionLookup,
  tick: number,
  /** What dealt the hit ('contact' for a bump), for a defence that tells them apart. */
  via: DamageVia | 'contact',
): {
  readonly rest: number;
  readonly event: HitReducedEvent | undefined;
  readonly raised: number;
} {
  const { incomingDamageOf } = getDefinition(definitions, target.definitionId);
  if (incomingDamageOf === undefined || amount <= 0) {
    return { rest: amount, event: undefined, raised: 0 };
  }
  const defended = incomingDamageOf(target, amount, tick, via);
  if (!Number.isFinite(defended)) {
    throw new Error(`Ball "${target.id}" defended a hit to a non-finite value`);
  }
  const rest = Math.max(0, Math.round(defended));
  if (rest >= amount) return { rest, event: undefined, raised: rest - amount };
  return {
    rest,
    event: { type: 'hitReduced', tick, ballId: target.id, sourceId, reduced: amount - rest, rest },
    raised: 0,
  };
}

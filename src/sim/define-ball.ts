import type { AbilityState, BallDefinition } from './types.ts';

/**
 * Declares a ball. Inside the definition, hooks see `self.abilityState` as the ball's own type
 * `S`; the result is the erased BallDefinition that the registry and step() work with.
 *
 * This is the one place the two are bridged, with a single cast. It is sound because a ball's
 * ability state is only ever created from its own `initialAbilityState` (createWorld) and replaced
 * by its own hooks' `setAbilityState` actions (apply-actions.ts), so a hook always receives the
 * state shape it declared. See ADR 0003.
 */
export function defineBall<S extends AbilityState>(definition: BallDefinition<S>): BallDefinition {
  return definition as unknown as BallDefinition;
}

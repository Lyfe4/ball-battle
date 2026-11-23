// A ball's ability as a newcomer sees it (ADR 0036): text and a pointer to the event that shows it.
// Plain data on the definition; it never changes a fight.
import type { StatusKind } from './status.ts';
import type { HookName } from './types.ts';

/** The moment that shows a ball's ability, read from the events its owner causes (ADR 0036). */
export type AbilitySign =
  | { readonly kind: 'projectileFired' }
  | { readonly kind: 'zoneSpawned' }
  | { readonly kind: 'minionSpawned' }
  | { readonly kind: 'rewound' }
  /** The ball split in two (the Slime, ADR 0060). */
  | { readonly kind: 'split' }
  | { readonly kind: 'hitReduced' }
  | { readonly kind: 'healed' }
  | { readonly kind: 'status'; readonly status: StatusKind }
  | { readonly kind: 'hookDamage'; readonly hook: HookName }
  | { readonly kind: 'hook'; readonly hook: HookName };

/**
 * What the arena's tip points at when the ability first shows (ADR 0036 addendum of 2026-11-23),
 * read from the event that showed it:
 * - `zone`: the zone it left (a bomb, a fire, a lightning mark), until the zone strikes or ends;
 * - `minion`: the minion it made, following it until it is gone;
 * - `struck`: the ball the ability landed on (slowed, poisoned, held, cursed, nipped by a web);
 * - `copy`: the ball's copy while there is one (`decoyOf`), else the ball;
 * - `self`: the ball itself. A shot's tip is on the ball that fired it: every shot crosses the
 *   court in well under a second, too fast for the eye to follow a label.
 */
export type TipOn = 'zone' | 'minion' | 'struck' | 'copy' | 'self';

export interface AbilityLabel {
  /** One or two words, title case: "Lightning", "Spikes". */
  readonly name: string;
  readonly shownBy: AbilitySign;
  /** Where the arena's tip goes (presentation only; it never changes a fight). */
  readonly tipOn: TipOn;
}

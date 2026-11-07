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
  | { readonly kind: 'shieldBroken' }
  | { readonly kind: 'healed' }
  | { readonly kind: 'status'; readonly status: StatusKind }
  | { readonly kind: 'hookDamage'; readonly hook: HookName }
  | { readonly kind: 'hook'; readonly hook: HookName };

export interface AbilityLabel {
  /** One or two words, title case: "Lightning", "Spikes". */
  readonly name: string;
  readonly shownBy: AbilitySign;
}

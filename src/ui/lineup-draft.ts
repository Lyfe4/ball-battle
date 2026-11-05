// Editing a lineup before a best-of-3 series: pure functions over the picked ids, in order, so the
// builder's rules are tested without a DOM. A draft holds 0 to LINEUP_SIZE different ids.
import { LINEUP_SIZE, type Lineup } from '../sim/series.ts';

export type Draft = readonly string[];

/** Adds `id` to the next empty slot. A ball already in the lineup, or a full lineup, is unchanged. */
export function addToDraft(draft: Draft, id: string): Draft {
  return draft.length >= LINEUP_SIZE || draft.includes(id) ? draft : [...draft, id];
}

/** Removes the ball in slot `index`; the ones after it move up, so the order is kept. */
export function removeFromDraft(draft: Draft, index: number): Draft {
  return draft.filter((_, i) => i !== index);
}

/** The lineup once all three slots are filled, otherwise undefined. */
export function completeLineup(draft: Draft): Lineup | undefined {
  const [first, second, third] = draft;
  return draft.length === LINEUP_SIZE &&
    first !== undefined &&
    second !== undefined &&
    third !== undefined
    ? [first, second, third]
    : undefined;
}

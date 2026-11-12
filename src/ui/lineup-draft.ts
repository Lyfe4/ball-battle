// Editing a lineup before a series: pure functions over the slots, so the builder's rules are
// tested without a DOM. A draft holds up to `size` slots (the series length, ADR 0048), each a ball id or empty
// (undefined), with no ball twice and no empty slot at the end.
//
// Taking a ball out leaves its slot empty, and the next pick fills the first empty slot. The usual
// reason to take a ball out is to swap it, so the new ball lands where the old one was and the
// order already set (which decides the rounds in Blind and Loser picks next) stays as it was.
import type { BestOf, Lineup } from '../sim/series.ts';

export type Draft = readonly (string | undefined)[];

/** Drops empty slots at the end, so a draft is never longer than its last ball. */
function trimmed(slots: readonly (string | undefined)[]): Draft {
  let end = slots.length;
  while (end > 0 && slots[end - 1] === undefined) end -= 1;
  return slots.slice(0, end);
}

/** How many balls are in the draft. */
export function draftCount(draft: Draft): number {
  return draft.filter((id) => id !== undefined).length;
}

/**
 * Adds `id` to the first empty slot. A ball already in the lineup, or a full lineup, is unchanged.
 */
export function addToDraft(draft: Draft, id: string, size: BestOf): Draft {
  if (draft.includes(id) || draftCount(draft) >= size) return draft;
  const gap = draft.indexOf(undefined);
  if (gap < 0) return [...draft, id];
  return draft.map((slot, index) => (index === gap ? id : slot));
}

/** Empties slot `index`; the other balls stay in their slots. */
export function removeFromDraft(draft: Draft, index: number): Draft {
  return trimmed(draft.map((slot, i) => (i === index ? undefined : slot)));
}

/** Takes `id` out of whichever slot holds it (a tap on its tile in the grid). */
export function removeBallFromDraft(draft: Draft, id: string): Draft {
  return removeFromDraft(draft, draft.indexOf(id));
}

/** A tap on a ball: out if it is in the lineup, otherwise into the first empty slot. */
export function toggleInDraft(draft: Draft, id: string, size: BestOf): Draft {
  return draft.includes(id) ? removeBallFromDraft(draft, id) : addToDraft(draft, id, size);
}

/**
 * A draft from saved slots (a link's lineup, or the tray kept while the player was away), keeping
 * each ball in its slot: unknown ids and repeats become empty slots, and anything past the last
 * slot (a Best of 5's tray opened for a Best of 3) is dropped.
 */
export function draftOf(slots: Draft, isKnown: (id: string) => boolean, size: BestOf): Draft {
  const seen = new Set<string>();
  return trimmed(
    slots.slice(0, size).map((id) => {
      if (id === undefined || !isKnown(id) || seen.has(id)) return undefined;
      seen.add(id);
      return id;
    }),
  );
}

/** The lineup once all `size` slots are filled, otherwise undefined. */
export function completeLineup(draft: Draft, size: BestOf): Lineup | undefined {
  const balls = draft.filter((id) => id !== undefined);
  return draft.length === size && balls.length === size ? balls : undefined;
}

/**
 * What an empty slot says: which slot it is ("Slot 2 · Empty") where the tray sets the order, so a
 * gap left by taking a ball out reads as the place the next pick goes. Reveal sets no order in the
 * tray (ADR 0025), so its slots are just "Empty". A Best of 5's five slots share a phone's row
 * (ADR 0048), so its ordered slots say only "Slot 2".
 */
export function emptySlotText(index: number, ordered: boolean, compact = false): string {
  if (!ordered) return 'Empty';
  return compact ? `Slot ${String(index + 1)}` : `Slot ${String(index + 1)} · Empty`;
}

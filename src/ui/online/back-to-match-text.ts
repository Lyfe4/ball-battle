// Home's "Back to your match" in words (ADR 0053), pure.
import type { CurrentMatch } from '../../api/live.ts';
import { FORMAT_SHORT, bestOfName } from '../series-text.ts';

/** A way back's words: what it opens, a quiet line under it, and both for a screen reader. */
export interface BackWords {
  readonly label: string;
  readonly meta: string;
  readonly spoken: string;
}

/** The button's words: what it opens, and what is being played. */
export function backWords(match: CurrentMatch): BackWords {
  const what = `${bestOfName(match.bestOf)} · ${FORMAT_SHORT[match.format]}`;
  if (match.kind === 'lobby') {
    return {
      label: 'Back to your lobby',
      meta: `Waiting for your friend · ${what}`,
      spoken: `Back to your lobby: waiting for your friend, ${what}`,
    };
  }
  const opponent = match.opponent ?? 'a deleted player';
  return {
    label: 'Back to your match',
    meta: `vs ${opponent} · ${what}`,
    spoken: `Back to your match against ${opponent}, ${what}`,
  };
}

/**
 * Home's way back to a rematch that waits on this player (2026-11-23): the end screen while the
 * one who asked waits for the answer, or the new lineup once both said yes.
 */
export function rematchBackWords(back: {
  readonly kind: 'answer' | 'lineup';
  readonly they: string;
}): BackWords {
  const meta =
    back.kind === 'answer'
      ? `Waiting for ${back.they} to answer`
      : `Choose your lineup · vs ${back.they}`;
  return { label: 'Back to your rematch', meta, spoken: `Back to your rematch: ${meta}` };
}

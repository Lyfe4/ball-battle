// Home's "Back to your match" in words (ADR 0053), pure.
import type { CurrentMatch } from '../../api/live.ts';
import { FORMAT_SHORT, bestOfName } from '../series-text.ts';

/** The button's words: what it opens, and what is being played. */
export function backWords(match: CurrentMatch): { label: string; meta: string; spoken: string } {
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

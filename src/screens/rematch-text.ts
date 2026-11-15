// A rematch's words (ADR 0055), pure: the card on the end screen while one is asked (with its
// seconds, on the pick card's bar), and the line both players read when it ends without a match.
import { REMATCH_ANSWER_MS, REMATCH_LINEUP_MS, type RematchView } from '../api/rematch.ts';
import { secondsUntil } from '../app/live-play.ts';
import type { Side } from '../sim/series.ts';
import { URGENT_SECONDS, type PickClock } from './pick-clock-text.ts';

/** The end screen's card for a rematch at server time `now`, seen from `you`. */
export function rematchClockOf(
  rematch: RematchView,
  you: Side,
  they: string,
  now: number,
): PickClock | undefined {
  const { deadline } = rematch;
  if (deadline === null) return undefined;
  const total = rematch.state === 'agreed' ? REMATCH_LINEUP_MS : REMATCH_ANSWER_MS;
  const seconds = secondsUntil(deadline, now);
  const timed = {
    seconds,
    left: Math.min(1, Math.max(0, (deadline - now) / total)),
    total: total / 1000,
    urgent: seconds <= URGENT_SECONDS,
  };
  if (rematch.state === 'asked') {
    return rematch.askedBy === you
      ? { kind: 'rematch', title: `Waiting for ${they} to answer`, ...timed }
      : { kind: 'rematch', title: `${they} wants a rematch`, ...timed };
  }
  if (rematch.state === 'agreed') {
    return {
      kind: 'rematch',
      title: rematch.lineupIn ? `Waiting for ${they}’s lineup` : 'Rematch on: build your lineup',
      ...timed,
    };
  }
  return undefined;
}

/** What both players read when a rematch ends without a match; undefined otherwise. */
export function rematchEnding(rematch: RematchView, you: Side, they: string): string | undefined {
  if (rematch.state === 'declined') {
    return rematch.declinedBy === you
      ? 'You said no to a rematch.'
      : `${they} said no to a rematch.`;
  }
  return rematch.state === 'expired' ? 'No rematch: time ran out.' : undefined;
}

/** The end screen's buttons: Rematch to ask, or Rematch and No thanks to answer. */
export function rematchChoiceOf(rematch: RematchView, you: Side): 'offer' | 'answer' | undefined {
  if (rematch.state === 'none' && rematch.offered) return 'offer';
  return rematch.state === 'asked' && rematch.askedBy !== you ? 'answer' : undefined;
}

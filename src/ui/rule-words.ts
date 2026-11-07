// Every interaction rule in words (ADR 0028, 0041), in one place: the hint the first time a rule
// acts, and the sentence in "How it was won". Both name the ball whose ability caused the rule, as
// the spark sits on it: Storm's shock, Quake's shockwave, Venom's poison.
import { ruleCauserId } from '../render/rule-cue.ts';
import type { RuleAppliedEvent, RuleId } from '../sim/rules.ts';
import type { BallState } from '../sim/types.ts';

/** What each rule does, said once per device by the ball whose ability caused it. */
export const RULE_HINTS: Readonly<Record<RuleId, string>> = {
  healCut: 'Shock halves healing!',
  aimHeld: 'Stagger stops aim!',
  rageNumbed: 'Poison numbs rage!',
};

/** A rule in a sentence: `by` caused it, `on` is the ball it acted on. */
export const RULE_WORDS: Readonly<Record<RuleId, (by: string, on: string) => string>> = {
  healCut: (by, on) => `${by}’s shock halved ${on}’s healing.`,
  aimHeld: (by, on) => `${by}’s shockwave stopped ${on} aiming.`,
  rageNumbed: (by, on) => `${by}’s poison numbed ${on}’s rage.`,
};

/** A rule's hint: shown on the ball that caused it. */
export function ruleHintOf(
  event: RuleAppliedEvent,
  balls: readonly BallState[],
): { readonly ballId: string; readonly text: string } {
  return { ballId: ruleCauserId(event, balls), text: RULE_HINTS[event.rule] };
}

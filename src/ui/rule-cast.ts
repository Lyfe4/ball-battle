// Who each interaction rule involves (ADR 0028, 0041): the ball whose ability causes it, the balls
// it acts on, and the word the text uses for it. Plain data for the tests that keep the words
// honest: rule-causer.test.ts checks it against real matches, and rule-text.test.ts checks every
// description and counter reason the rule touches says so.
import type { RuleId } from '../sim/rules.ts';

export interface RuleCast {
  readonly rule: RuleId;
  readonly causer: string;
  readonly affected: readonly string[];
  /** The word that names the rule in a description or a reason. */
  readonly word: RegExp;
}

export const RULE_CAST: readonly RuleCast[] = [
  { rule: 'healCut', causer: 'storm', affected: ['vampire'], word: /shock/i },
  { rule: 'aimHeld', causer: 'quake', affected: ['archer', 'sniper', 'storm'], word: /stagger/i },
  { rule: 'rageNumbed', causer: 'venom', affected: ['berserker'], word: /numb/i },
];

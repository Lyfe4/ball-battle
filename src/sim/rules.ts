// Interaction rules (ADR 0028): the few places where one ball's effect meets another ball's
// mechanic. Each one emits a `ruleApplied` event the moment it acts, so the arena can show it with
// one consistent cue. Output only: the sim never reads these events back.

/**
 * Every interaction rule, by what it does:
 * - healCut: a shocked ball heals less (shock meets any healer; today the Vampire), ADR 0009.
 * - aimHeld: a staggered ball can't aim, so its due attack is held or its lock breaks (a Quake's
 *   shockwave meets any ball that aims: the Archer, Storm and Sniper), ADR 0016.
 * - rageNumbed: a poisoned Berserker's hit lands without most of its rage (Venom meets the
 *   Berserker), ADR 0016.
 */
export type RuleId = 'healCut' | 'aimHeld' | 'rageNumbed';

/**
 * What an aimed ball's hook returns on the tick its attack comes due while it is staggered: the
 * attack waits, and the arena shows why (ADR 0028). Once, on the due tick itself.
 */
export function heldAim(
  tick: number,
  dueTick: number,
):
  | readonly [
      {
        readonly kind: 'ruleApplied';
        readonly rule: 'aimHeld';
      },
    ]
  | readonly [] {
  return tick === dueTick ? [{ kind: 'ruleApplied', rule: 'aimHeld' }] : [];
}

/** An interaction rule acted on `ballId` this tick. */
export interface RuleAppliedEvent {
  readonly type: 'ruleApplied';
  readonly tick: number;
  readonly ballId: string;
  readonly rule: RuleId;
}

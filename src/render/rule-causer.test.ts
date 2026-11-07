// The rule spark goes on the ball whose ability caused the rule (ADR 0041), read from the status
// that made the rule act. Checked against real matches, so a new rule or status source shows up.
import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { getDefinition } from '../sim/definitions.ts';
import type { RuleAppliedEvent } from '../sim/rules.ts';
import { step } from '../sim/step.ts';
import { createWorld } from '../sim/world.ts';
import { ruleCauserId } from './rule-cue.ts';
import { RULE_CAST } from '../ui/rule-cast.ts';

/** Each rule, the ball whose ability causes it, and the balls it acts on (rule-cast.ts). */
const RULES = RULE_CAST.map(({ rule, causer, affected }) => [rule, causer, affected] as const);

describe('the ball that caused a rule', () => {
  it.each(RULES)(
    '%s: the spark goes on the %s, never on the ball it acted on',
    (rule, causer, on) => {
      let seen = 0;
      for (const affected of on) {
        for (let seed = 0; seed < 3; seed += 1) {
          const ids = [causer, affected];
          let world = createWorld(
            seed,
            ids.map((id) => getDefinition(BALL_LOOKUP, id)),
          );
          while (world.match.status === 'running') {
            const result = step(world, BALL_LOOKUP);
            world = result.world;
            for (const event of result.events) {
              if (event.type !== 'ruleApplied' || event.rule !== rule) continue;
              seen += 1;
              const by = ruleCauserId(event, world.balls);
              const ball = world.balls.find((candidate) => candidate.id === by);
              expect([ball?.definitionId, by === event.ballId]).toStrictEqual([causer, false]);
            }
          }
        }
      }
      expect(seen).toBeGreaterThan(0);
    },
  );

  it('falls back to the other ball, or the ball itself with nothing to go on', () => {
    const world = createWorld(1, [
      getDefinition(BALL_LOOKUP, 'venom'),
      getDefinition(BALL_LOOKUP, 'berserker'),
    ]);
    const [venom, berserker] = world.balls;
    const event: RuleAppliedEvent = {
      type: 'ruleApplied',
      tick: 0,
      ballId: berserker?.id ?? '',
      rule: 'rageNumbed',
    };
    expect(ruleCauserId(event, world.balls)).toBe(venom?.id);
    expect(ruleCauserId(event, [])).toBe(event.ballId);
  });
});

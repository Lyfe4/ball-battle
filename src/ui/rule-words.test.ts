import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { getDefinition } from '../sim/definitions.ts';
import { createWorld } from '../sim/world.ts';
import { RULE_WORDS, ruleHintOf } from './rule-words.ts';

describe('a rule’s hint', () => {
  it('shows on the ball whose ability caused the rule, saying what it did (ADR 0041)', () => {
    const world = createWorld(2, [
      getDefinition(BALL_LOOKUP, 'quake'),
      getDefinition(BALL_LOOKUP, 'archer'),
    ]);
    const [quake, archer] = world.balls;
    const hint = ruleHintOf(
      { type: 'ruleApplied', tick: 5, ballId: archer?.id ?? '', rule: 'aimHeld' },
      world.balls,
    );
    expect(hint).toStrictEqual({ ballId: quake?.id, text: 'Stagger stops aim!' });
  });
});

describe('a rule in How it was won', () => {
  it('names the ball whose ability caused it first, then the ball it acted on', () => {
    expect(RULE_WORDS.healCut('Storm', 'Vampire')).toBe('Storm’s shock halved Vampire’s healing.');
    expect(RULE_WORDS.aimHeld('Quake', 'Archer')).toBe('Quake’s shockwave stopped Archer aiming.');
    expect(RULE_WORDS.rageNumbed('Venom', 'Berserker')).toBe(
      'Venom’s poison numbed Berserker’s rage.',
    );
  });
});

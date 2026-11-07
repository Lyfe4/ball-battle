// Every ball an interaction rule involves says so (ADR 0041): its description names the rule, and
// so does the counter reason between the ball that causes it and each ball it acts on.
import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { counterFor } from '../sim/counter-map.ts';
import { RULE_CAST } from './rule-cast.ts';

describe('the words for each interaction rule', () => {
  it.each(RULE_CAST)('$rule: in every description and reason it touches', (cast) => {
    const missing: string[] = [];
    for (const id of [cast.causer, ...cast.affected]) {
      const description = BALL_LOOKUP.get(id)?.description ?? '';
      if (!cast.word.test(description)) missing.push(`${id}'s description`);
    }
    for (const id of cast.affected) {
      const reason = counterFor(cast.causer, id)?.reason ?? '';
      if (!cast.word.test(reason)) missing.push(`${cast.causer} vs ${id}`);
    }
    expect(missing).toStrictEqual([]);
  });
});

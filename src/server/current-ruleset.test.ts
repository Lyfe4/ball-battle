import { describe, expect, it } from 'vitest';
import { RULESET_VERSION as SIM_RULESET } from '../sim/index.ts';
import { RULESET_VERSION } from './current-ruleset.ts';

describe("the server's current ruleset", () => {
  it('is the build sim’s, so new series are played under the rules the client plays', () => {
    expect(RULESET_VERSION).toBe(SIM_RULESET);
  });
});

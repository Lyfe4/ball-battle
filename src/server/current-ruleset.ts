// The ruleset new server series are created under: this build's, the one its client plays. The
// server never imports the live sim's values (rulesets.ts), so the number is kept here and
// `current-ruleset.test.ts` fails when it differs from src/sim/ruleset.ts. Bump both together.
export const RULESET_VERSION = 15;

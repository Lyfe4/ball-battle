// Which rules and stats produced a fight (ADR 0022). A match is (seed, balls) and a series is its
// setup, but neither means anything without the ball definitions, the combat rules, the bot and the
// series rules that played it. Every link and every series setup records this number, so an old
// link is recognised instead of silently replaying a different fight, and a server can reject a
// result played under other rules.
//
// Bump it in the same commit as any change that can change a fight, a bot's choice or a series
// result: a ball's stats or ability, the combat rules in `step`, the counter map's intended sides
// (the bot reads them), the roster or its order (the bot picks from it), seeds and salts.
// `ruleset.test.ts` plays a fixed set of matches, bot choices and series and fails when their
// fingerprint changes without a new version. Text-only changes (names, descriptions, reasons,
// colours) need no bump. After a bump, run `pnpm golden` to record the new known match results
// (`src/golden/golden-matches.json`, ADR 0023).

export const RULESET_VERSION = 1;

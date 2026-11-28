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

export const RULESET_VERSION = 25;

/**
 * Older rulesets whose series this build still verifies and replays exactly (ADR 0073): their
 * fights, roster, series rules, seeds and salts are today's, and only their bots differ, which
 * are kept (`botFor`). `golden.test.ts` checks each one's frozen known results are today's. A
 * bump that changes anything but a bot empties this list (and its retired bots go): ruleset 25
 * changed fights (the Speedster's speed per stack, ADR 0091 addendum), so ruleset 24 links show
 * the older-link notice.
 */
export const SAME_FIGHTS_AS: readonly number[] = [];

/** True when a series or link made under `ruleset` replays exactly in this build. */
export function replaysHere(ruleset: number): boolean {
  return ruleset === RULESET_VERSION || SAME_FIGHTS_AS.includes(ruleset);
}

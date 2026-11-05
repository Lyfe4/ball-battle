# 0022: Ruleset version, and one rule for a valid series

- Status: Accepted
- Date: 2026-11-05
- Amends: ADR 0017 (the link, the bot), ADR 0019 (links, picks)

## Context

An audit of `main` found two gaps that matter now and more once a server verifies results
(`docs/vision.md`, step 2):

- **Links didn't say which rules made them.** A match is `(seed, balls)` and a series is its
  setup. Neither recorded the stats, combat rules, bot or series rules that played it. Ball stats
  change often, so after any tuning commit an old link silently replayed a different fight,
  possibly with a different winner. A server and a client on different builds would disagree
  in the same way, and neither could tell why.
- **The browser and `playSeries` disagreed about a bad link, and nobody checked the bot's
  side.** The browser dropped a link pick that wasn't legal and played the rest live.
  `playSeries`, the function a server would run, threw on the same input. And a hand-edited
  `lb=` or bot pick replayed a "win" against a bot that never played that way.

## Decision

### 1. `RULESET_VERSION`, guarded by a fingerprint of behaviour

`src/sim/ruleset.ts` holds one integer. It is bumped in the same commit as any change that can
change a fight, a bot's choice or a series result. That covers stats, abilities, `step`, the
counter map's sides (the bot reads them), the roster and its order (the bot picks from it), and
seeds and salts. Text and colours need no bump.

`ruleset.test.ts` makes the bump hard to forget. It plays a whole match for every pair of balls
(mirrors included), asks the bot every kind of choice, and plays a series in every format. It
hashes only the results and compares the hash with an append-only table of fingerprints per
version. A one-unit speed change fails it, and so does a counter-map side that only the bot reads.
I chose behaviour over hashing the definitions' numbers because it also catches ability
constants, the combat rules and the bot. Its cost is about 0.5 s in the unit suite.

It is one hash, not a record per match. The known results per match, and their runs in Firefox
and WebKit, which the audit also asked for (its H2), are ADR 0023.

### 2. Links and setups record it

- `SeriesSetup.ruleset` is required, and every quick-match and decided-series link writes `v=`.
  Setup-step URLs replay nothing and carry none.
- A link without `v`, or with one that isn't a plain integer, reads as 0 (unversioned).

### 3. What an outdated link does

`parseRoute` sends a replay link from another ruleset to its own screen, `outdated`
(`src/outdated-screen.ts`). It doesn't play it.

- **Older or unversioned:** "This match was played on an earlier version of BallBattle. Balls or
  rules may have changed since, so it may not play out the way it did." One action, **Play with
  today's rules**, rewrites `v=` in place and opens the link as a current one. Back goes home.
- **Newer:** a page from an older deploy (a tab left open, a cached page) meets a link from a
  newer one. The screen offers **Reload** first, then **Play with this version**.
- Under today's rules a quick match always plays. A series plays only if it passes the check
  below; otherwise it opens the lineup step, prefilled with the player's lineup and the format.

Rejected:

- Silently replaying, which is the old behaviour and the bug.
- Refusing outright, because the balls and seed are still a fine match to watch.
- Keeping old rulesets in the bundle to replay old links exactly. That costs code size and test
  burden for every ruleset forever. A server can keep old builds if it ever needs exact old
  results.

Every link shared before this change has no `v`, so it shows the notice, even when it would still
replay the same fight. We can't tell which ones would, and saying so is honest.

### 4. One rule for a valid series: `verifySeries`

`src/sim/series-verify.ts` plays a setup and accepts it only if all of these hold:

- it was played under today's ruleset;
- both lineups are three different balls from the roster;
- for a bot opponent, side B is the lineup that bot picks from its lineup seed, and every pick
  the bot was due is the pick it makes;
- every pick was legal when it was made, none is missing and none is left over.

`playSeries` is `verifySeries` plus a throw. The browser runs the same function before replaying a
series link, from `parseRoute`. A link it refuses opens the lineup step, prefilled, like any
other incomplete link. The old "drop an illegal link pick and play on live" rule from ADR 0019 §5
is gone. A replay costs about 12 ms on a desktop and runs once per link.

### 5. The opponent is part of the setup

`SeriesSetup.opponent` is one of two kinds:

- `{ kind: 'bot', bot, lineupSeed }`: the bot is named by its id in `BOTS`. `lineupSeed` is the
  seed it picked its lineup from. That's the series seed, except after a Rematch, which keeps the
  bot's lineup under a new series seed. A rematch link writes `bs=` for it.
- `{ kind: 'player' }`: the lineup and picks are the player's own, so only their legality is
  checked. A link can't express it; it is for a server that knows who played.

Bot picks are still stored in links (ADR 0019 §4), and verification now checks them.

## Consequences

- Positive: an old link is recognised instead of replaying a different fight. A server can
  reject a submission played under another ruleset, or one whose bot side the bot would not have
  played. The browser and the server can't disagree about a link, because they run one function.
- Positive: the bump is enforced by a test, not by memory.
- Negative: every link from before this change shows the notice once. Every balance commit also
  bumps the version and adds a fingerprint, and links from before it then show the notice.
- Negative: a valid link now costs a headless replay before it plays (about 12 ms on a desktop,
  more on a phone).
- Open: the seed still comes from the client (`generateSeed`), so a client can reroll seeds until
  it likes the result. A server must issue seeds, or use a commit-reveal scheme, before results
  count for anything (audit, deployment notes).

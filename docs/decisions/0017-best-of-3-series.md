# 0017: Best-of-3 series against a bot

- Status: Accepted
- Date: 2026-11-05
- Implements: step 1 of `docs/vision.md` ("round structure against a bot lineup, locally")

## Context

The vision's PvP mode is a guessing game over three rounds: each side picks three balls blind and
in order, round _i_ is the two _i_-th balls, and the first to two round wins takes the series. Step
1 builds that structure locally against a bot, and it must be ready for step 2, where a server
re-simulates a reported series to verify it. Mirror draws were decided in `docs/vision.md`
(replay with a derived seed, with a cap and a fallback to decide here).

## Decision

### 1. Series logic is pure sim code

`src/sim/series.ts` holds the rules as plain data and pure functions, under the same restrictions
as the rest of `src/sim` (no DOM, no clock, no `Math.random`, integer seed maths only):

- `SeriesSetup` is `{ seed, a, b }`: the series seed and two lineups of three different ball ids.
  It is everything that decides a series.
- `SeriesState` holds the finished rounds, the outcomes of the round in progress (draws only) and
  the winner once decided. `nextMatch(state)` says which match to play next (round, attempt, seed,
  both balls) and `recordOutcome(state, outcome)` records how it ended. The browser plays matches
  one at a time through these two; `playSeries(setup, definitions)` plays the whole series
  headlessly through the same two, which is what a server would run. A test checks the two paths
  agree.
- Side A is always the player's lineup in slot A (ball-0), side B the opponent's.
- **First to two:** the series ends as soon as a side has two round wins, so 2-0 never plays round 3.

### 2. Seeds

All derived with `deriveSeed` (the murmur3-style integer mix already used for hook streams,
ADR 0003), each with its own salt so streams never coincide:

- round seed = `deriveSeed([seriesSeed, ROUND_SALT, round])`;
- the first play of a round uses the round seed; replay `n` (after `n` draws) uses
  `deriveSeed([roundSeed, ATTEMPT_SALT, n])`;
- the sudden-death coin is the first float of `deriveSeed([roundSeed, SUDDEN_DEATH_SALT])`: below
  0.5 goes to side A.

### 3. Draws: replay, then sudden death

A drawn round is replayed on the next attempt seed, **up to 3 plays**. If all three draw, a seeded
coin flip decides the round, shown as **sudden death** ("drew 3 times; sudden death went to
you"). Deterministic, so a server reaches the same result. Mirrors draw at most 17% of the time
(Speedster), so three draws in a row is about 0.5% of Speedster mirror rounds and far rarer for
any other pair; the coin almost never decides anything. Rejected: a sim tiebreak (changes every
match, see `docs/vision.md`), and unlimited replays (a server must bound the work it does to verify
a result).

### 4. The bot

`src/sim/bot.ts` defines `LineupBot { id, pickLineup(seed, roster) }`. The only bot today,
`randomBot`, picks three different balls uniformly in a random order from a stream seeded by the
series seed (with its own salt). A smarter bot (counter-picking, or learning a player's openers)
implements the same interface; nothing else changes. The lineup it picked is part of the setup
and the link, so a link keeps replaying the same series even if the bot changes later.

### 5. The link

`?mode=bo3&la=a,b,c&lb=d,e,f&seed=N` (`src/app/series-url.ts`). Ids are trimmed and lowercased,
like quick-match links. A complete, valid link replays the series exactly: tested by parsing a
written link and comparing `playSeries` results. Anything invalid (a duplicate, an unknown id, the
wrong count, a bad or missing seed) falls back to the lineup builder, prefilled with the player's
lineup when that part is valid. `mode=bo3` alone opens the builder.

**The bot's lineup is never in the address bar before the series is decided:** while building and
playing, the URL is just `?mode=bo3`, and the full link is written when the last round ends. A
series opened from a full link shows it from the start (it's a replay).

### 6. UI

Plain DOM, as before:

- **Mode choice** above the picker: Quick match / Best of 3, a labelled group of `aria-pressed`
  buttons (the same segmented control now used by the speed toggle).
- **Lineup builder** (`lineup-builder.ts`): three ordered slots, each with move up, move down and
  remove (44 px targets, named for screen readers, e.g. "Move Storm up"); Choose balls opens the
  same ball dialog as the picker (now shared, `ball-dialog.ts`), where each tap fills the next
  empty slot and balls already picked are disabled with "In slot N". Clear empties the lineup;
  Start series is enabled once all three are filled. Focus moves to a useful control when the one
  in use disables itself. The rules are pure functions with tests (`lineup-draft.ts`).
- **Scoreboard** (`series-panel.ts`): the score ("You 1 – 0 Bot"), every finished round, and an
  `aria-live` status line. Between rounds it names your next ball against "a hidden ball" and
  offers Next round (Replay round after a draw); the bot's ball is revealed as the round starts.
  At the end: the result, Rematch (same lineups, new seed) and New series (back to the builder,
  with the last lineup kept). The HUD labels the sides You / Bot and hides Replay / New match,
  which would break a series.
- The match pauses while the lineup dialog is open, like the picker (ADR 0011).

## Consequences

- Positive: the round structure is ready for step 2. A server needs only `playSeries` and a
  setup to verify a result, and the browser and the server can't disagree because they run the
  same two functions.
- Positive: the bot is replaceable without touching the series, the link or the UI.
- Negative: links now come in two shapes (quick match and series), and the series link is longer.
  Commas in the lineup are URL-encoded (`%2C`) by `URLSearchParams`.
- Negative: in best-of-3 mode before a series starts, the last quick match keeps playing behind
  the builder rather than the arena going blank.
- Found while building it: the frame the result appears on was never redrawn (the result's 950 ms
  delay outlasts every effect, so the loop had stopped drawing), so a result could wait for an
  unrelated redraw. The frame loop now also draws when the result appears.

## Addendum: notes from the build (2026-11-05)

- **Rounds start with a Next round button**, not automatically after a pause, so the scoreboard can
  be read and screen readers announce each result before the next round begins. Auto-advance with
  the button as a skip is the alternative, still open.
- **The full link stores both lineups**, not just the seed, so a link keeps replaying the same
  series after the bot changes.
- **The series wiring lives in `src/series-controller.ts`** (moved out of `main.ts`, which had grown
  to 335 lines), so `main.ts` stays wiring for the arena and frame loop.
- The CSP check (`pnpm preview`) was not re-run for this step: nothing new is loaded from the
  network.

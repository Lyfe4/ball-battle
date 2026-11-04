# 0011: Roster scaling: balance runs, slow tests, picker

- Status: Accepted
- Date: 2026-11-04

## Context

The vision (`docs/vision.md`) heads towards about 25 balls. Three things scaled with the square of
the roster or with its length: `pnpm balance` (77 s for five balls), the roster-wide tests that
play every matchup, and the picker (two native selects). This records the groundwork laid before
the roster grows.

## Decision

### 1. Parallel `pnpm balance`

- The script builds a list of independent jobs (per pair: the base run and four ±5% health runs;
  then each mirror), slices each job by seed, and plays the slices on worker threads, one per
  core (`scripts/balance-jobs.ts`, `balance-worker.ts`).
- Slices merge exactly: wins, draws and damage are counts and whole-number sums, and match
  lengths are only used through the median, which ignores their order. So the output is
  byte-identical to a serial run (`--serial`) and to the script before it. This was proved by
  `cmp` on 500-seed runs.
- Matches tally damage per tick instead of keeping every event. Same sums, less memory.
- The elapsed time goes to stderr, so stdout can be diffed between runs.
- 77 s → 24 s on an 8-core, 16-thread machine. It doesn't scale further because the sim
  allocates a fresh immutable world every tick, so memory bandwidth, not core count, is the limit.
  Making the sim allocate less is a separate decision.

### 2. `pnpm balance --ball <id>`

Plays only that ball's matchups and mirror, and checks the targets (and its counter-map entries)
for that ball alone. For adding or tuning one ball. Arguments are parsed with `node:util`
`parseArgs` in strict mode, so an unknown option or a missing value is an error.

### 3. A slow test suite

Tests that play every matchup for whole matches live in `*.slow.test.ts`: roster-wide
determinism, the measured pass-through property (its frozen 0.6 margin unchanged) and the
identity rules. Vitest has two projects, `unit` (`pnpm test`) and `slow` (`pnpm test:slow`). CI
runs them as two separate jobs and both must pass. The unit suite went from 5.5 s to 2.3 s.
Roster-wide tests that play whole matches belong in the slow suite.

### 4. Picker

- Two slot buttons, each showing its ball with the game's own drawing, plus Start match. A slot
  opens a modal `<dialog>` with a grid of every ball: drawing, name and one-line description.
- The cards are buttons with `aria-pressed` in a `role="group"`, not radios, because radios change
  the selection on every arrow press. Focus is roving: arrow keys, Home and End move, Tab leaves
  the grid in one step. Enter or Space picks and returns focus to the slot; Escape or the backdrop
  closes.
- Phones get one column (two-line descriptions don't fit two columns of ~150 px). Checked with
  25 cards: the dialog stays on screen and the grid scrolls inside it.
- A pick does nothing until Start match, as before.
- **The match pauses while the dialog is open** and carries on where it stopped when it closes,
  whether or not a pick changed. The frame loop asks the picker whether its dialog is open rather
  than listening for its `close` event, which did not fire in a background tab during testing.
- The keyboard logic is a pure function with tests (`src/ui/grid-nav.ts`). There is no DOM test
  environment (adding jsdom would be a new dependency); the rest was checked by hand.

### 5. Phone layout

On tall screens the arena and HUD start at the top instead of being centred, which left a large
empty band above the arena. The side-by-side layout stays centred.

## Consequences

- Positive: balance runs stay usable as the roster grows, the everyday test run stays fast, and
  the picker works for 25 balls on a phone.
- Negative: two test suites to remember (CI runs both). Balance speed is capped by the sim's
  allocation, not the hardware.

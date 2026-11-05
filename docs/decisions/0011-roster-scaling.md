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

## Addendum: the slow suite split by concern, and a balance check in CI (2026-11-05)

An audit found the roster-wide checks growing badly. One file of 17 tests ran in series (Vitest
parallelises by file) and took 70 s here, 80 s on the auditor's machine. The balance bands
weren't in CI at all, so a stat change could push a pair out of its counter-map band and CI stayed
green.

- **One file per concern.** The suite is now split into `determinism`, `pass-through` and
  `ability-share` slow files, with their helpers in `src/sim/balls/roster-support.ts`. The
  identity rules that only read the definitions moved to the unit suite (`identity.test.ts`),
  where they run in milliseconds.
- **Pass-through plays each pair once.** It plays every pair (mirrors included) instead of every
  ordered pair, alternating the slot order between seeds, so both orders are still covered.
  Closing speed doesn't depend on the slot, and both samplings find the same worst case today
  (0.373 of the limit).
- The slow suite now takes 34 s here. It still grows with the square of the roster; the files run
  in parallel.
- **`pnpm balance:ci`**, its own CI job, plays 150 seeds per slot order without the sensitivity
  runs (80% of a full run's cost). That's 20 s here. A counter-map pair fails only when it is
  outside its band by more than three standard errors of the sample: 8.7 points at 300 games,
  against a full run's 2 (`ciAllowance`). The other targets are checked as in a full run. The
  seeds are fixed, so the check can't flake; it can only let a borderline pair through, which a
  full run still judges. It passes on today's code and fails clearly when Vampire's lifesteal is
  set to 0.
- `pnpm balance` exits with 1 when any target is a MISS.
- Not changed: the counter-map data stays in files by batch. The audit suggested one file per
  ball. Each pair belongs to two balls, so a per-ball file still has to pick an owner, and the
  test that every pair has exactly one entry already gives the safety.

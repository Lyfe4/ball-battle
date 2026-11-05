# 0024: Player-facing text and colours stay in the ball definitions

- Status: Accepted (closes audit finding L7 as won't-fix)
- Date: 2026-11-05

## Context

The 2026-11-05 audit (L7) noted that `src/sim` holds text and colour that only players see: each
`BallDefinition`'s `name`, `description` and `color` (`src/sim/types.ts`), and every counter-map
entry's `reason` (`src/sim/counter-map.ts`). The bot needs the counter map's sides, not its prose,
and nothing in a fight reads a colour. The audit suggested moving them to a render/ui-side table
keyed by ball id, in case the sim is shared with a server.

## Decision

Leave them where they are, and record why.

- **They can't change a result.** `step`, the bot and the series rules never read them.
  `ruleset.test.ts` hashes results only, and the known match results (ADR 0023) hash worlds and
  events, neither of which contains them, so a copy change needs no ruleset bump. Determinism
  (ADR 0001) is untouched: they are constant strings.
- **A server can ignore them.** Verifying a series needs ids, stats and hooks; the text costs a
  server a few kilobytes and no logic.
- **A ball is one file** (`defineBall`, one file per ball in `src/sim/balls/`). A new ball
  today is one file plus its counter-map entries, and its description sits next to the stats it
  describes, so the two are reviewed together. Splitting would churn all 11 ball files and both
  counter-map data files, add a second table that every new ball must remember, and need a test
  that the two tables cover the same ids. That is real cost for no change in behaviour.
- The UI already reads text and colour only from the definitions and the counter map
  (`src/ui/balls/matchups.ts`), so there is one source and nothing to drift.

## Consequences

- Positive: no churn; a ball stays one reviewable file; copy edits stay outside the ruleset.
- Negative: `src/sim` holds some strings that have nothing to do with simulating, and a server
  bundle carries them.
- Revisit if the game is translated (text would then need a table per language keyed by id), if
  a server bundle's size starts to matter, or if a field like these ever feeds a decision in the
  sim, at which point it is no longer presentation.

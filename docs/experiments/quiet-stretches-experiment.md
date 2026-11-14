# Quiet stretches: what was prototyped, what is kept, what was dropped

> **Scripts:** the measuring scripts this cites (under `scripts/`) were never merged to `main`: they
> lived on the experiment's own branch. The numbers here are the record.

Measured on 2026-11-12 at ruleset 12, in prototype branches that were never merged. Contact-only
pairs often go a long time with no contact and no damage (today: 78% of contact-only games have a
5 s+ quiet stretch, 29% a 10 s+ one, the worst 50 s). Read this before trying any of these again.

## Kept for later: the lane fix (`proto/contact-A`)

**What it is.** After a bounce off one wall, the ball never leaves within 10° of that wall's
perpendicular (its speed along the wall is at least sin 10° of its speed, `MIN_OFF_NORMAL_SIN`),
and it keeps the sideways direction it had before the seeded turn (ADR 0004), so it never reverses
sideways without touching a side wall. Speed is unchanged. It stops balls settling into lanes that
bounce straight up and down past each other. The change is `offNormal` in
`src/sim/bounce-variance.ts` on the branch `proto/contact-A` (one commit, `ef03223`, with the gap
measurement scripts in `scripts/prototype/`).

**What it does** (200 seeds, on its own):

- Quiet stretches: the worst gap falls from 50 s to 41 s, and 10 s+ stretches in contact + area
  pairs from 8.2% to 7.0% of games. Nothing else moves.
- Balance: an average move of 2.8 points per pair, two pairs moved 8+. **The Storm falls from
  51.5% to 47.3%** (balls drift out of its warned strike instead of bouncing straight back into
  it), and the Bomber rises from 51.6% to 55.4%.
- **Storm vs Chrono measures 21.6 / 78.4**, past the 22/78 hard limit.

**How it ships.** With the next balance change, in the same retune as a Storm buff (and a check of
the Bomber), with a `RULESET_VERSION` bump and new known results. Not on its own.

## Dropped: the shrinking arena (`proto/combo*`, `proto/contact-C`)

The walls closed in evenly from a set time (10, 12 or 15 s) to 650 wide over 15 s, tried together
with the lane fix and Ghost phasing.

- **It cannot reach the main source.** In contact-only pairs 60 of every 100 games have a 5 s+
  quiet stretch that starts in the first 5 seconds; no shrink touches that (5 s+ share stays at
  77-79%). It does cut the late ones: 10 s+ stretches starting after 10 s fall from 13.6 to 2.9 per
  100 games, and the worst gap from 50 s to about 30 s.
- **It breaks balance.** Shrinking from 10 s moved pairs 3.8 points on average, 23 pairs by 8+.
  The Bloom fell from 49.8% to 40.2% (a closing court means more hits, and its regrowth pauses
  after each), its edges collapsed (Frost vs Bloom 27 to 50, Berserker vs Bloom 24 to 45), and the
  Sniper fell from 49.6% to 43.5%. All three switches untuned: 19-24 MISS pairs and 14 ball shapes
  off at every start time. The best retune found (from 12 s, the Bloom's pause 60 to 40 ticks, the
  Sniper's shot 27 to 30) still had 13 MISS pairs, 7 shapes off and Storm vs Chrono at 21.6/78.4.
- **It is a large build.** The court's bounds would become a function of the tick everywhere in
  the sim (collision, the Chrono's rewind, projectiles, minions, zones, bombs and patches left
  outside the wall, a ball resting on a moving wall), plus rendering and the phone arena.

## Dropped: Ghost phasing (`proto/combo-*G*`)

While faded, the Ghost passed through other balls (no bounce, no damage either way).

- No effect on quiet stretches.
- **The Ghost falls from 45.4% to 35.1%**: a faded Ghost no longer lands free bumps (24 each).
  Ghost vs Inferno 67 to 44, Ghost vs Boomerang 52 to 30, Quake vs Ghost 45 to 67, Archer vs Ghost
  60 to 80. Not the "aim waits for a phased ball" rule: with that off it still wins 34%.
- About +10 health (73) restores it to 48-50%, but then the Brawler no longer beats the Ghost
  (52.5% the other way), breaking the pinned rule that the Brawler beats only the Ghost; the Inferno
  and Frost counters vanish and the Archer gains 68%.

Bringing it back would be a Ghost redesign with its own ADR, not a tuning step.

## Also dropped

The face-off charge (`proto/contact-P`: after a quiet stretch every ball turns toward its nearest
enemy) and a wider seeded wall turn (`proto/contact-D`: up to 15° instead of 8°, ADR 0004) were
ruled out. The opening of a fight, the largest source of quiet
stretches, still needs its own idea.

Only `proto/contact-A` was kept. The other `proto/contact-*` and `proto/combo*` branches and their
worktrees were deleted on 2026-11-13.

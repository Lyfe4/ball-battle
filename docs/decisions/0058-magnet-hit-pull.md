# 0058: The Magnet pulls shooters in (ruleset 18)

> **Scripts:** the measuring harness the proposal cites (`scripts/new-balls/`) lives on
> `proto/magnet-shooters` and was never merged to `main`. The numbers here are from `pnpm balance`
> on the shipped code, and match the proposal's config A game for game.

- Status: Accepted
- Date: 2026-11-17
- Amends: ADR 0026 (the Magnet), ADR 0045 (the known gaps, group 4), ADR 0049 (the even picks),
  ADR 0056 (the Magnet stays)
- Proposal: `docs/magnet-proposal.md` on `proto/magnet-shooters` (config A)

## Context

The Magnet was an even pick by accident: its pull every 2 s is movement too soft to decide a pair,
so it beat nobody and lost only to Thorns (ADR 0056). The proposal gave the pull a reason to
matter: a ball that hits it from range gets pulled in at once, into the brawl the Magnet wants.
That gives three clear wins with every other ball untouched, but only one loss (Thorns): 3-1, off
the shape. Every weaker Magnet lifts the Frost first, and the Frost (3-2) has no room for a fourth
win; the buffs that would give it a second loss reach far too wide (the proposal's table).

## Decision

**The ability.** The pull every 2 s stays as it was (0.6 s at share 0.025). New: when a projectile
or a minion hits the Magnet (an arrow, spear, shot, boomerang or skull: the hit's `via`), it pulls
its enemy in at once, harder (`HIT_PULL_SHARE` 0.07) for 1 s (`HIT_PULL_TICKS` 60), then a hit
can't start another for 1 s (`HIT_PULL_REST_TICKS` 60). A hit during a pull starts nothing; a
timed pull that starts during a hit-started one keeps the harder pull until both end. Health,
bump and speed unchanged (68, 25, 760).

- **One clear thing, the same on any ball:** it reacts to the kind of hit, as the Battery stores a
  kind of hit (ADR 0056). Against a ball that never hits from range it is the old Magnet. No rule
  exists only where two abilities meet.
- **One-liner:** "Pulls every 2 s, and at once when hit from range." (The proposal's "Pulls its
  enemy in every 2 s, …" wraps to three lines at 375 px; the manual's text check fits this one.)
  Its "How it works" is built from the constants above.
- **Look:** unchanged. The dashed pull line already shows every pull, and the "Pull!" hint shows
  on the first one, timed or hit-started.

Counter map: the Magnet is favoured over the Archer, Boomerang and Necromancer, each because the
hit that would hurt it drags the shooter into its bumps. The bot reads the map, so it now offers
the Magnet against all three.

| Magnet (500 seeds)  | Overall | Shape | Wins                                              | Losses      |
| ------------------- | ------: | ----- | ------------------------------------------------- | ----------- |
| Before (ruleset 17) |   49.9% | 0-1   | -                                                 | Thorns 74.8 |
| **After (r18)**     |   51.6% | 3-1   | **Archer 75.5, Boomerang 66.1, Necromancer 65.2** | Thorns 74.8 |

Only pairs with a ball that throws or summons move; the Spartan (its spear starts a pull) goes
50.3 → 55.8, still even, and the Sniper 54.2 → 54.8.

**The Necromancer is the soft win.** 65.2% at 500 seeds, 63.7% in CI's 150-seed check; ±5% health
moves the pair by 6.0 points at most (the rule's warn line is 15), so it holds. The Archer (75.5)
sits under the 78% ceiling with 2.5 points to spare.

**The shape exception (owner's decision).** The Magnet loses to one ball, like the Ghost, and the
gap is recorded for a future ball: one that beats it in a brawl (a ball that never hits from range
meets only the timed pull). With three wins over one loss the counts are 2 apart, so its allowance
is one loss and wins and losses within 2 (`SHAPE_EXCEPTIONS.magnet`). The Magnet is no longer an
even pick: the Brawler is the only one (`EVEN_PICKS`). The exception goes as soon as a ball beats
the Magnet (the Slime is the first candidate).

## The roster (500 seeds, `pnpm balance`)

Every hard rule passes: every ball 45.8-52.0% overall (the Magnet 51.6%), worst side 24.4%, draws
0.5%, median fight 16.3 s, comebacks 18.3%, ±5% health moves a rate by at most 11.9 points, every
pair inside its floor, every ball on its shape or its named exception. `pnpm balance:ci` (150
seeds) passes too: the Archer 71.7, Boomerang 68.7, Necromancer 63.7, Thorns over it 74.0. `docs/balance-summary.md` is regenerated.

| Ball        | Ruleset 17 | Ruleset 18 | Why                  |
| ----------- | ---------- | ---------- | -------------------- |
| Magnet      | 0-1 (even) | 3-1        | The hit-started pull |
| Archer      | 4-3        | 4-4        | Loses to the Magnet  |
| Boomerang   | 3-3        | 3-4        | Loses to the Magnet  |
| Necromancer | 2-2        | 2-3        | Loses to the Magnet  |

## Consequences

- Ruleset 18 (golden results regenerated, frozen as `rulesets/r18/`; r15-r17 stay for open online
  series). No migration.
- The Archer (4-4), Boomerang (3-4) and Necromancer (2-3) each take one more loss. The Archer has
  no room for another, so the Slime (`docs/vision.md`) can no longer beat it.
- The Magnet's missing loss is a gap for the next ball: a brawler that never hits from range.

# 0057: The Sniper's quick lock, its second win (ruleset 17)

> **Scripts:** the measuring harness this cites (`scripts/new-balls/`) lives on
> `proto/sniper-slime` and was never merged to `main`. The numbers here are the record.

- Status: Accepted
- Date: 2026-11-17
- Amends: ADR 0045 (the known gaps, group 4), ADR 0047 (the Sniper's one-win allowance)
- Proposal: `docs/sniper-slime-proposal.md` on `proto/sniper-slime` (Step 1)

## Context

Since the Guardian left (ADR 0047) the Sniper beat only Thorns, so it needed a named shape
exception (one win). The proposal looked for a second win from its ability rather than its stats,
and found one in the Spartan: a planted Spartan moves at 0.42 of its speed, so a quicker lock
lands far more shots on it, and half a shot (its shield) is still a shot.

## Decision

The lock goes from 0.3 s to 0.2 s (`CHARGE_TICKS` 18 → 12) and the shot from 27 to 22
(`SHOT_DAMAGE`). Cadence is unchanged (one shot about every 2 s). It still locks on, shows its
laser and fires one heavy shot; it commits sooner and hits a little softer. The lighter shot keeps
the rest of its row level, and 22 stays below the Storm's strike (identity rule).

Counter map: Spartan vs Sniper goes from `even` to the Sniper favoured ("Planted, it is too slow to
leave a 0.2 s lock"). The bot reads the map, so it now offers the Sniper against the Spartan.

| Sniper (500 seeds)     | Overall | Wins                          | Losses                      |
| ---------------------- | ------: | ----------------------------- | --------------------------- |
| Before (ruleset 16)    |   48.4% | Thorns 63.8                   | Chrono 76.1, Speedster 64.5 |
| **After (ruleset 17)** |   50.6% | **Spartan 64.4**, Thorns 64.9 | Chrono 63.5, Speedster 64.0 |

The Spartan had room for a loss (2-2 → 2-3). Levers tried and dropped (a streak, a heavier slower
shot, a wider shot, recoil, a pin, knockback, a shield-piercing shot) are in the proposal; each
either missed 62% or gave a win over a ball with no room for another loss.

The Sniper's shape exception is removed; it is 2-2. The named exceptions left: the Titan (1-1),
Berserker (up to 5 wins), Bloom (up to 5 losses), Ghost (1 loss), Quake (1 win) and the Vampire
(within 2).

## The roster (500 seeds, `pnpm balance`)

Every hard rule passes: every ball 45.8-52.0%, worst side 24.4%, draws 0.5%, median fight 16.3 s,
comebacks 18.3%, ±5% health moves a rate by at most 11.9 points, every pair inside its floor,
every ball on its shape. `pnpm balance:ci` (150 seeds) passes too.

## Consequences

- Ruleset 17 (golden results regenerated, frozen as `rulesets/r17/`; r15 and r16 stay for open
  online series). No migration.
- The Sniper now has two losses and two wins with no room either way: a new ball that beats it
  (the Slime, `docs/vision.md`) still needs another ball to give way first.

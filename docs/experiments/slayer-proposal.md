# The Slayer: prototype and proposal

> Archived on 2026-11-14 from the deleted branch `new-balls/slayer` (commit `bc78884`), whose
> commit said "not for merge". Only this write-up was kept: the prototype and its scripts are not
> on `main`, and the paths below name files that were only on that branch.

Proposal only, not for merge (branch `new-balls/slayer`). Ruleset 12. The prototype is
`src/sim/balls/new/slayer.ts` (not in `BALLS`, so the game and its tests are unchanged); the
measuring scripts are `scripts/new-balls/`. Whole-roster checks play the Slayer's 21 pairs on top of
ruleset 12's full 500-seed run (`runs/r12-base.json`); tuning used 150-200 seeds.

**Verdict: don't add it.** Neither version reaches the aims, and both break other balls' shapes.
Details below.

## 1. The ball as asked: "Hits harder the healthier its enemy is."

Its bump is `low + (high - low) × share`, where `share` is the enemy's health share (1 at full
health, 0 at none). It works the same on any ball and needs no engine change. Every tick its
`onTick` notes the nearest enemy's health over the most it has been seen with (which is that ball's
max, since every ball starts full and no heal passes max), and `contactDamageOf` reads that
(contact comes after `onTick` in the tick).

**Look:** a sword pointing at the enemy whose length and width follow the share, from a full blade
down to a stub (`src/render/ball-designs/slayer.ts`; `slayer-preview.html`, dev only, shows it
large and at phone size). It reads clearly at phone size.

### What it does (calibrated near 50%)

| Setting (high / low / health) | Overall | Beats                           | Loses to                       |
| ----------------------------- | ------: | ------------------------------- | ------------------------------ |
| 50 / 10 / 55                  |   51.4% | Vampire 92, Bloom 83, Archer 65 | Thorns 88, Frost 68, Chrono 66 |
| 46 / 14 / 52                  |   49.3% | Vampire 89, Bloom 73            | Thorns 85, Frost 69, Chrono 65 |
| 42 / 18 / 50                  |   46.0% | Vampire 83                      | Thorns 86, Frost 63            |
| 36 / 20 / 58 (flattest)       |   48.2% | Vampire 75                      | Thorns 80, Chrono 62           |

Steeper scaling (the share squared) was far worse: 23-25% overall, losing to 17 balls.

**Why it misses the aims:**

- **It crushes the glass cannons instead of losing to them.** Damage follows the enemy's _share_,
  so a Vampire at full health (39) takes the same opening hit as a Berserker at full health (86),
  and that one hit is most of the Vampire. It wins 75-92%, over the 78% cap in most settings.
- **It doesn't beat the Berserker.** The Berserker's high health doesn't matter to a share, and each
  big hit feeds its rage: the Berserker wins 56-62%.
- **Thorns crushes it** (80-88%; the Slayer's side is 12-20%, under the 22% hard floor in every
  setting): the spikes reflect 37% of each big bump.
- **Venom doesn't beat it** (the Slayer wins 52-60%): low health of its own doesn't help when its
  first hits are the biggest. The Bloom is beaten (73-83%), as hoped, but over the cap.

## 2. Variant: damage that follows the enemy's health in points

The aims (beat the high-health Berserker, lose to low-health glass cannons) fit damage that follows
the enemy's _current health in points_ better: a bump of `base + rate × the enemy's health`. Same
sword. This is a different rule from the one asked for, so it is a variant to report, not a pick.

| Setting (base / rate / health) | Overall | Beats                                                    | Loses to                                           |
| ------------------------------ | ------: | -------------------------------------------------------- | -------------------------------------------------- |
| 18 / 0.25 / 66                 |   50.9% | Berserker 64.9, Speedster 63.6                           | Thorns 63.9                                        |
| 16 / 0.3 / 66                  |   49.4% | Berserker 63.6, Speedster 62.5                           | Chrono 65.0, Thorns 64.6, Vampire 63.2, Bloom 62.5 |
| 18 / 0.25 / 64                 |   48.3% | (none)                                                   | Thorns 67.3, Chrono 63.6                           |
| 18 / 0.25 / 70, speed 700      |   51.8% | Speedster 65.5, Necromancer 63.9, Ghost 63.2, Venom 62.0 | (none)                                             |

(400 seeds on top of the 500-seed base.) A hit that is a share of what the enemy has left shrinks
as the enemy weakens, so the base has to carry the finishing blows; with a small base it lost
nearly every match (0-2%).

**Closer to the aims, still off:** it beats the Berserker and, at the steeper rate, loses to the
Vampire. But the Bloom beats it (the Bloom's 49 health means small hits), it beats Venom (58-59%),
and it is 2-1 or 2-4, never 2-2 to 4-4.

## 3. The whole roster

Every setting of either version puts at least one existing ball off its shape:

- **Thorns goes 4-2** (it beats the Slayer by reflecting it, on top of its three wins) in every
  setting where the Slayer's bumps are big enough to matter.
- **Chrono goes 5-4** wherever it beats the Slayer (it rewinds the big hits).
- **Bloom goes to 6 wins** (over its allowance of 5) wherever it beats the Slayer.

**Gaps it touches:** the points variant gives the **Berserker** a loss (5-2 to 5-3), the only
known gap it narrows. The share version beats the Bloom, which the Bloom's gap needs, but at 73-83%
(over the cap). Neither touches the Storm, Titan, Bomber or Magnet. Since no setting
passed the hard rules and shapes, the ±5% health sensitivity was not run.

## 4. Why I'd not add it

1. As asked (health share) it is the opposite of its brief: it crushes the glass cannons and
   can't touch the Berserker, and Thorns crushes it under the hard floor.
2. As a variant (health in points) it gets closer, but it is a different ability from the one
   approved, it still can't lose to Venom or beat the Bloom, and it pushes Thorns off-shape.
3. Its one clear edge, beating the Berserker, overlaps the Vampire's role.

What might work instead, if the Berserker and Bloom gaps are the target: a ball whose big hit
lands once in a while on a timer (feeding the rage only once, outpacing regrowth), which the
round-2 notes already point to (`docs/vision.md`, "Something that punishes the Berserker and the
Bloom").

## Reproduce

```bash
node scripts/new-balls/sweep.ts slayer configs.txt --seeds 150
```

```bash
node scripts/new-balls/compose.ts scripts/new-balls/runs/r12-base.json --add slayer --set "slayer.absolute=1,slayer.low=18,slayer.rate=0.25,slayer.hp=66" --seeds 400
```

`pairs.ts --all --without slayer --out runs/r12-base.json` rebuilds the base (it matches
`pnpm balance`).

# 0014: Venom, favoured against Thorns

- Status: Accepted
- Date: 2026-11-06

## Context

Venom was built for batch 1 to be favoured against the Storm and did not fit (ADR 0012 §6):
poison rewards long fights, but nothing about the Storm made its fights long enough to set it
apart from the Brawler. The poisoned status stayed in the sim, tested and unused.

Two retargets were measured, both keeping "Vampire favoured against Venom" (lifesteal out-heals
poison):

1. **Venom favoured against Thorns.** Thorns reflects only contact damage (ADR 0013). Most of a
   low-contact Venom's damage is poison, which never touches the spikes, the same reason the
   Archer beats Thorns.
2. **Venom favoured against the Frost.** The slowest ball has the longest fights, so poison gets
   the most ticks.

Option 1 was preferred if both fit, because its reason is specific to the opponent.

## Decision

### 1. Option 1: Venom is Thorns' counter

A sweep of 60 configs (contact damage 7-13, health 68-84, poison 180-300 ticks, speed 760-780,
200-500 seeds per slot order) gave:

- **Thorns:** among configs where Venom won 40-60% overall, Venom vs Thorns ran 10-20 points
  above Venom vs Brawler with contact damage 7-9, and only 0-6 points above with 11-13. That is
  the mechanic showing: the less Venom hits, the less Thorns reflects.
- **Frost:** Venom vs Frost ran 1-15 points _below_ Venom vs Brawler at every config. Longer
  fights help the poison, but the Frost also hits hard (22) and slows Venom, so there is no
  Frost-specific edge. Option 2 does not fit.
- **Vampire:** 9-14 points below Venom vs Brawler near even, so it is favoured once Venom
  sits near 50% overall.

### 2. Stats

Speed 780, health 76, contact damage 8 (the Archer keeps the lowest, 6), poison for 260 ticks on
every contact, at the shared `POISON_DAMAGE` (2) every `POISON_INTERVAL_TICKS` (30). A fresh
poison deals 8 ticks (16 damage); every new contact refreshes it without resetting its rhythm
(ADR 0012).

Poison length is the strongest lever: 180 → 300 ticks moves Venom's overall rate by 20-35 points.
Each point of contact damage moves it about 4-5 points and narrows the Thorns gap.

### 3. Counter map

| Pair                                     | Intended         | Mechanical reason                                                            |
| ---------------------------------------- | ---------------- | ---------------------------------------------------------------------------- |
| Venom vs Thorns                          | Venom favoured   | Poison never touches the spikes, and its light hits leave little to reflect. |
| Vampire vs Venom                         | Vampire favoured | Lifesteal out-heals the poison: every trade heals back what it chipped.      |
| Brawler vs Venom                         | Even             | Safe pick.                                                                   |
| Venom vs Speedster, Archer, Storm, Frost | Even             | No mechanic favours either side.                                             |

### 4. Results

`pnpm balance 500 --ball venom`:

| Pair               | Intended | Result      | Check |
| ------------------ | -------- | ----------- | ----- |
| Venom vs Thorns    | Venom    | 64.1 / 35.6 | ok    |
| Vampire vs Venom   | Vampire  | 58.8 / 40.9 | WARN  |
| Brawler vs Venom   | Even     | 47.1 / 52.2 | ok    |
| Venom vs Speedster | Even     | 47.7 / 51.8 | ok    |
| Venom vs Archer    | Even     | 50.8 / 48.9 | ok    |
| Venom vs Storm     | Even     | 47.9 / 52.0 | ok    |
| Venom vs Frost     | Even     | 48.5 / 51.2 | ok    |

Venom 50.3% overall, 64.8% of its damage from poison. Draws 0.4%, median 18.8 s, worst ±5%
sensitivity 13.7 points (Speedster vs Venom). Every target passes. Pairs without Venom are
unchanged.

An identity rule pins it: Venom gets at least half its damage from poison.

### 5. Rendering

Venom is a flat poison drop in a dark accent. A poisoned ball gets a still ring of round pale-lime
dots, in the same thin style as the shocked and slowed rings and outside both.

## Consequences

- Positive: Thorns gets a second counter from the same mechanic as its first two (damage that
  never touches the spikes), so its identity reads the same way in every unfavoured pair.
- Positive: the poison status, unused since ADR 0012, now has a ball, and its refresh-without-reset
  rule matters: Venom touches often.
- Negative: Venom's matches are the longest in the roster (median 18.8 s), and its sensitivity
  against the Speedster (13.7 points) is close to the 15-point warning.
- Negative: Venom vs Frost is even, so the Frost still has only one unfavoured matchup.

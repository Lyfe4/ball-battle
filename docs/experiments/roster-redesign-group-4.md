# Roster redesign, group 4: proposal

> **Scripts:** the measuring scripts this cites (under `scripts/`) were never merged to `main`: they
> lived on the experiment's own branch. The numbers here are the record.

Proposal only, not for merge (branch `roster-redesign/group-4-proposal`). The prototype is the ball
files on this branch; numbers are its measured win rates, 500 seeds per slot order (about ±2.2 points
per pair), against ruleset 10 at the same seeds. Reproduce with `scripts/redesign-g4/` (see the head
of `pairs.ts`); the two runs are `final-500.json` and `ruleset-10-500.json` there.

**Rule used** (yours): counter ≥ 62% (aim 65-72, never above 78); even 42-58; 58-62 not allowed;
every ball 2-4 strong and 2-4 weak, counts within 1; Brawler even, Thorns its weakness, one or two
counters at most.

**Short version:** five kind-of-hit reworks work and give most balls both a strength and a
weakness (balls missing a side: 9 → 2). But the map does not meet the new rule: 37 pairs fall in
58-62 or above 78 (23 today), and 11 balls are still off-shape. Numbers alone don't fix this,
for the same reason as group 3: they shift a whole row. Section 3 says what I think can't be
reached and what I'd do instead.

## 1. The 21 balls

### Decisions for you (top)

| Ball      | Mark                                   | Old → new                                                                                                                                                                      | Why                                                                                                                                                                                                                                                                           |
| --------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Berserker | **Reworked**                           | Old: huge health; the more hurt it is, the harder it hits. New: every hit it takes builds rage (up to 3); its next bump lets it all out (+3 a point). Base bump 18, health 86. | Rage from missing health only moved its whole row (0 counters at every setting). Rage from _hits taken_ is a kind of hit: many small hits fill it, a few big ones don't. Breaks the identity rule "Brawler hits hardest, even against a raging Berserker" (18 + 9 = 27 > 26). |
| Titan     | **Reworked**                           | Old: grows bigger and heavier. New: grows bigger, and its bumps grow with it (×1.7 at full size). Base bump 14.5, health 83.                                                   | Growth alone gave 4 wins and no losses. Bumps that start weak and end huge give it a weakness early on and in fire (Inferno) and a late crush on sustain (Bloom). Its late bump (25) is close to the Brawler's 26; the identity test needs a decision.                        |
| Quake     | **Reworked (numbers change its kind)** | Old: a shockwave of 11 on a wall hit, at most every 0.5 s, radius 200. New: a shockwave of 6 on a wall hit, at most every 0.2 s, radius 250.                                   | At 11-13 its row moved as a block (0 counters). As true chip it beats what can't rewind small hits (Chrono) and loses to what blunts them (armor, rage).                                                                                                                      |
| Bomber    | **Reworked (numbers change its kind)** | Old: a bomb (12) every 2.2 s. New: a big bomb (24) every 3.7 s; health 69 → 64.                                                                                                | As chip it had no edges (0/0). As a big blast it is clearly rewound by the Chrono and catches the rushing Speedster.                                                                                                                                                          |
| Brawler   | **Rule exception to approve**          | Unchanged. Gains one edge: over the Ghost (63%).                                                                                                                               | Any ball weak to plain hard bumps loses to the Brawler too. The Ghost's only measured weakness is the Brawler. Within your "one or two counters at most".                                                                                                                     |
| Magnet    | **Replace or keep even?**              | Pull share 0.03 → 0.025, health 69 → 68. Still no edge.                                                                                                                        | Pulling shooters in measures 59-60% (Speedster, Archer, Bloom): movement, too close to noise. No pull setting gave a second counter. Options: (a) keep it as a second even pick, (b) replace it (not prototyped).                                                             |

No ball added or removed in the prototype. If you pick (b) for the Magnet, I'd prototype a
replacement that hits a kind not yet covered: something that beats the skull and the giant (the
Necromancer and the Titan lack a weakness) by dealing its damage in one heavy close-range blow.

### Numbers only (no decision needed)

| Ball                                                              | Changes                                                                              |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Vampire                                                           | Heals 90% of what its bumps deal (was 50%); health 54 → 40. Text: "heals most of …". |
| Guardian                                                          | Armor 1 → 3 (still never under half a hit); health 74 → 59.                          |
| Storm                                                             | Strike 36 → 40; health 79 → 74.                                                      |
| Ghost                                                             | Fades at most every 160 ticks (was 205); health 67 → 63.                             |
| Frost                                                             | Slow lasts 4 s (was 3); health 80 → 77.                                              |
| Thorns                                                            | Reflects 39% (was 36%).                                                              |
| Boomerang                                                         | Hits 7 (was 6); health 57 → 50.                                                      |
| Necromancer                                                       | Health 70 → 73.                                                                      |
| Speedster, Archer, Sniper, Venom, Chrono, Inferno, Bloom, Brawler | Unchanged.                                                                           |

## 2. Strong vs / weak vs (prototype, %)

✓ = shape meets the rule. Pairs in the 58-62 gap are listed as "gap".

- **Brawler** 50% ✓ (with the exception): beats Ghost 63 (a hard bump lands whole before it fades). Loses to Thorns 27 (every hard bump hurts it back). Gap: Guardian 60.
- **Speedster** 48% ✓ 3/3: beats Archer 71, Sniper 65, Boomerang 72 (too fast to aim at). Loses to Frost 35 (slowed, builds no speed), Bomber 37 (runs into the blasts), Guardian 34 (armor takes some off every speed hit).
- **Vampire** 51% ✓ 2/3: beats Berserker 74, Bloom 63 (long bump fights against big health: it drinks most of it back). Loses to Archer 33, Storm 25, Boomerang 35 (they never touch it, so nothing to drink). Gap: Frost, Thorns, Chrono, Titan, Bomber.
- **Archer** 49% ✓ 2/3: beats Vampire 67 (nothing to drink), Thorns 64 (arrows never touch the spikes). Loses to Speedster 29, Berserker 36 (every arrow builds rage), Necromancer 23 (the skull draws the arrows). Gap: 4 pairs.
- **Storm** 51% ✗ 1/1: beats Vampire 75 (one strike is most of its health). Loses to Chrono 25 (rewinds the strike). Gap: Bloom 60.
- **Frost** 48% ✗ 1/1: beats Speedster 65. Loses to Bloom 37 (regrows through a slow fight). Gap: 7 pairs.
- **Thorns** 51% ✗ 2/4: beats Brawler 73, Magnet 75 (hard bumps hurt them back). Loses to Archer 36, Venom 31, Sniper 35, Inferno 35 (never touch the spikes). Gap: 5 pairs, among them Berserker 59.
- **Venom** 48% ✓ 2/3: beats Thorns 69, Chrono 66 (poison ticks never touch the spikes and are too small to rewind). Loses to Berserker 22 (every tick builds rage), Ghost 35 (the next tick misses), Guardian 20 (armor takes most of each tick). **Two sides under 22%.**
- **Berserker** 52% ✗ 5/2: beats Archer 64, Venom 78, Quake 63, Inferno 63, Boomerang 67 (many small hits fill its rage). Loses to Vampire 26, Bloom 32 (they heal back each big bump).
- **Sniper** 50% ✓ 2/3: beats Thorns 65 (never touches it), Guardian 63 (armor barely dents a heavy shot). Loses to Speedster 35, Necromancer 37 (the skull draws the shot), Chrono 25 (rewinds it).
- **Quake** 48% ✗ 1/2: beats Chrono 63 (waves too small to rewind). Loses to Berserker 36 (every wave builds rage), Guardian 31 (armor takes half of each wave). Gap: Necromancer 61.
- **Magnet** 51% ✗ 0/1: loses to Thorns 25 (it pulls the spikes into itself). Gap: Speedster, Archer, Bloom (59-60).
- **Ghost** 46% ✗ 1/1: beats Venom 65 (the next tick misses). Loses to Brawler 35. Gap: Inferno 60.
- **Necromancer** 52% ✗ 3/0: beats Archer 77, Sniper 63, Boomerang 75 (the skull draws aimed attacks). No loss: Quake, Inferno and Bloom sit at 61.
- **Chrono** 49% ✓ 3/3: beats Storm 75, Sniper 75, Bomber 67 (rewinds big hits). Loses to Venom 33, Quake 36, Inferno 27 (small hits it can't rewind).
- **Titan** 51% ✗ 1/1: beats Bloom 62 (its late bumps outpace regrowth). Loses to Inferno 37 (a huge body crosses all the fire). Gap: 6 pairs.
- **Inferno** 51% ✓ 3/2: beats Thorns 65, Chrono 73, Titan 62. Loses to Berserker 37 (every burn builds rage), Bloom 32 (regrows faster than it burns).
- **Boomerang** 46% ✗ 1/4: beats Vampire 65. Loses to Speedster 28, Berserker 33, Necromancer 25, Guardian 30 (armor takes a big share of each small hit).
- **Bomber** 52% ✗ 1/1: beats Speedster 63 (runs into the blasts). Loses to Chrono 33 (rewinds each blast). Gap: Vampire, Guardian, Bloom.
- **Guardian** 50% ✓ 4/4: beats Speedster 66, Venom 80 (too sharp), Quake 68, Boomerang 69 (armor takes a big share of small hits). Loses to Brawler 37 (not mirrored: draws), Frost 38, Sniper 37, Bloom 34 (big or steady hits it barely blunts).
- **Bloom** 51% ✓ 3/2: beats Berserker 66, Inferno 67, Guardian 65 (regrows faster than they hurt). Loses to Vampire 37, Titan 37 (big bumps outpace regrowth).

## 3. How close the map gets

| Check                                    | Ruleset 10 | Prototype | Rule        |
| ---------------------------------------- | ---------- | --------- | ----------- |
| Pairs that are counters (≥62)            | 31         | 42        | about 45-80 |
| Pairs failing (58-62, or above 78)       | 23         | **37**    | 0           |
| Balls with the right shape               | 8 of 21    | 10 of 21  | 21          |
| Balls missing a side (no win or no loss) | 9          | **2**     | 0           |
| Each ball overall                        | 47-54%     | 46-52%    | 45-55       |
| Weakest side of any pair                 | 25.1%      | **20.3%** | 22          |
| Median fight                             | 17.3 s     | 17.2 s    | 12-30       |
| Draws                                    | 0.6%       | 0.6%      | under 5     |
| Comebacks (loser once led by 25+)        | 16.5%      | 18.5%     | 10-20       |

What I think can't be reached, and why:

- **"No pair in 58-62" is not reachable by tuning.** 210 pairs spread continuously from about 20
  to 80; a 4-point band in the busiest part of that spread catches 10-17% of pairs whatever the
  numbers are, and ±2.2 points of noise at 500 seeds moves pairs in and out of it between runs. Every
  tuning step that pushed one pair out pushed another in (the optimizer plateaued at 22-28 at 200
  seeds). **My recommendation:** keep "a counter needs 62", but count 58-62 as even with a warning
  (as today's "below target"), not a failure. Under that reading 37 failing pairs become 2:
  Guardian vs Venom (80/20) and Berserker vs Venom (78/22).
- **2-4 each way for every ball** needs about 50+ counters. Kind reworks got 42; the rest sit in
  the gap. The off-shape balls split in two:
  - Fixable by a further pair-level pass: Storm, Frost, Quake, Bomber, Titan, Ghost (each 1/1 with
    2-7 pairs in the gap on the right side), Berserker (one win too many), Thorns, Boomerang (one
    loss too many).
  - Not fixable by numbers: Magnet (no edge at any setting) and Necromancer (no loss: the area
    balls that should clear the skull reach 61 at most).
- **Venom's two sharp losses** (Guardian 80, Berserker 78) come from the same thing that makes them
  counters (many small ticks). Fixable by fewer, bigger poison ticks; not tried yet.

## 4. The reveal-analysis thresholds

With this map relabelled from the measurements (≥62 favoured, else even; 42 favoured pairs), the
two shares the tests check are **83.7%** (take turns) and **80.8%** (show first), against 79.2% and
75.5% for ruleset 10. Both clear 80%, so they can go back to 80. The show-first margin is thin:
it needs about 42 or more favoured pairs, so the threshold should move back only once the final
map has at least that many.

## What the prototype does not include

No counter-map entries, words, golden results or ruleset bump; ruleset, identity and ball unit
tests are stale on this branch. Ball files carry a `PROTOTYPE` note where an ability changed.

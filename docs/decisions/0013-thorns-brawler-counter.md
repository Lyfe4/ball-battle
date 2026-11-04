# 0013: Thorns, the Brawler's one counter

- Status: Accepted
- Date: 2026-11-04
- Amends: ADR 0010 (the safe-pick rule)

## Context

Thorns reflects part of every contact hit it takes back at the attacker (`onDamageTaken`,
ADR 0012). It was first meant to be favoured against the Vampire and even against the Brawler,
and it could not be. Reflection scales with the attacker's hit, and the Brawler is the hardest
hitter (26). Everywhere Brawler vs Thorns was even, the Vampire beat Thorns by 15-30 points, since
lifesteal heals back part of every trade. Reflecting on-hit bonuses as well (the Speedster's stack
bonus, with Thorns favoured against the Speedster instead) fixed the Brawler and Vampire pairs. But
it needed a fragile Thorns (health 50), and then the Storm and Archer, whose attacks are never
reflected, beat it 65/35 and 73/27.

The conflict was with the safe-pick rule, not with tuning: the mechanic's natural victim is the
ball the rules said must stay even.

## Decision

### 1. The Brawler gets one designed counter

The safe-pick rule (ADR 0010, `docs/vision.md`) becomes: **the Brawler is even against every ball
except Thorns.** The hardest hitter hurts itself the most on the spikes. A safe pick also needs
one known counter, so it isn't a dominant blind pick. `SAFE_PICK_COUNTERS` in
`scripts/counter-map.ts` names Thorns, and the counter-map test checks that Thorns is favoured
against the Brawler and every other Brawler pair is even. Changing it is a design decision.

### 2. Thorns' counter map

| Pair                | Intended        | Mechanical reason                                              |
| ------------------- | --------------- | -------------------------------------------------------------- |
| Thorns vs Brawler   | Thorns favoured | The hardest hitter hurts itself the most on the spikes.        |
| Archer vs Thorns    | Archer favoured | Arrows never touch the spikes, so they are never reflected.    |
| Storm vs Thorns     | Storm favoured  | Lightning never touches the spikes, so it is never reflected.  |
| Thorns vs Speedster | Even            | Reflection answers its contact hits, but it hits softly.       |
| Thorns vs Vampire   | Even            | Reflection hurts, but lifesteal heals back part of each trade. |
| Thorns vs Frost     | Even            | The Frost hits hard into the spikes, but slows Thorns.         |

### 3. Plain contact reflection

Thorns reflects `REFLECT_SHARE` (35%) of each contact hit it takes, rounded, as its own ability
damage. Ability damage (arrows, lightning, poison, the Speedster's stack bonus) is never
reflected. Reflecting on-hit bonuses as well was measured and dropped. In a 128-config sweep
against the new map, the best config with it scored about four times worse than the best without:
it pushes Thorns vs Speedster from even towards 70%. Plain reflection also needs no extra
information on the hook. `onDamageTaken`'s context stays
`{ attacker, amount, cause }`.

Stats: speed 730, health 75, contact damage 19. Each 0.1 of reflect share moves Brawler vs Thorns
by about 10 points, so the share is tuned to 0.35, between the two grid steps.

### 4. Results

`pnpm balance`, 500 seeds per slot order, all seven balls:

| Pair                | Intended | Result      | Check |
| ------------------- | -------- | ----------- | ----- |
| Thorns vs Brawler   | Thorns   | 68.1 / 31.3 | WARN  |
| Archer vs Thorns    | Archer   | 64.7 / 35.2 | ok    |
| Storm vs Thorns     | Storm    | 56.9 / 43.0 | NEAR  |
| Thorns vs Speedster | Even     | 53.9 / 45.6 | WARN  |
| Thorns vs Vampire   | Even     | 48.0 / 50.6 | ok    |
| Thorns vs Frost     | Even     | 48.1 / 50.1 | ok    |

Per ball: Brawler 45.6%, Speedster 48.8%, Vampire 46.7% (heals 32.9% of max), Archer 53.2%,
Storm 53.0%, Frost 51.5%, Thorns 49.3% (22.5% of its damage reflected). Draws 0.5%, median
16.6 s, worst side 31.3%, worst ±5% sensitivity 10.4 points. Every target passes. Pairs without
Thorns are unchanged.

**What limits the fit.** Storm vs Thorns is the weak pair. A slower Thorns gives the Storm more
hits (at 745 the Storm won about 4 points less than at 730), but the Frost must stay the slowest
ball (720), and a Thorns just above it would blur that identity. At 730, Storm vs Thorns sits just
below its band, inside the noise allowance.

## Consequences

- Positive: the safe pick has one known counter, so a blind Brawler is no longer risk-free, and
  the counter comes from a mechanic anyone can see: the hardest hits bounce back hardest.
- Positive: Thorns' unfavoured matchups come from the same mechanic (ranged attacks are never
  reflected), so its identity reads in both directions.
- Negative: the Brawler's overall win rate drops to 45.6%, the lowest it has been. It still sits
  inside 40-60%, but a future counter aimed at the Brawler would need care.

# New balls, step 1: proposal

> Kept for the record: the decisions are in ADR 0047 (the Spartan with a half shield, no Dodger,
> the Magnet stays). The prototype code and its measuring scripts were on the deleted branch
> `new-balls/proposal` and are not on `main`; the paths below refer to that branch.

Proposal only (branch `new-balls/proposal`). Ruleset 11. Prototype balls are in
`src/sim/balls/new/` (not in `BALLS`, so the game and its tests are unchanged); the measuring
scripts are `scripts/new-balls/` (head of `pairs.ts`). Win rates are 500 seeds per slot order for
the whole-roster check and 150-300 while prototyping (about ±4 points per pair at 150).

**Short version:** I recommend **one** new ball, the **Bubble**, and **replacing the Magnet**. I
looked for 3-4 and prototyped 15 mechanics; only the Bubble fills gaps without breaking others
that can't be fixed by numbers. Every other candidate either hit the same wall (below) or failed a
hard rule. The Bubble still needs one decision from you (section 3).

## 1. Replace the Magnet: yes

No candidate gave the Magnet a real counter either way: its pull is movement, and every ball that
punishes a forced brawl beats the Brawler too, which the even-pick rule forbids. Removing it costs
nothing elsewhere (Thorns goes 3-3 → 2-3, inside its shape) and frees the room Thorns needs to take
the Bubble's loss. The Brawler stays the one plain even pick (beats the Ghost, loses to Thorns).

## 2. The new ball

### Bubble: "A bubble stops the next shot, strike or blast, then regrows."

A Brawler-like bumper (bump 26, health 59, speed 770) inside a bubble that blocks the whole of the
next hit from afar, whatever its size, then takes 14 s to regrow. Bumps go through it. On screen: a
clear ring round the ball that bursts when it blocks and thickens back as it regrows.

| Beats         | Rate | Why                                                                                                                                         |
| ------------- | ---: | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Sniper        | 76.3 | Its heavy shot is one hit from afar: the bubble eats it.                                                                                    |
| Storm         | 70.9 | One big strike every few seconds: the bubble eats it.                                                                                       |
| Bomber        | 68.8 | One big blast: the bubble eats it.                                                                                                          |
| **Loses to**  |      |                                                                                                                                             |
| Thorns        | 68.7 | Its hard bumps hurt it back (as the Brawler's).                                                                                             |
| Frost (see 3) | 64.4 | No mechanical reason: its body is weaker than the Brawler's, paying for the bubble, and the slow sturdy Frost is the first to cash that in. |

Overall 48.9%. Grey (58-62, shown even): Brawler 61.5 over it, Necromancer 60.3. Small hits from
afar (arrows, burns, poison ticks, a boomerang) pop it cheaply, so it does nothing special against
them. Gaps filled: **Bomber's second loss** (closed), **Storm's second loss** (the Storm still has
one win, so it keeps a smaller exception: 1 win allowed instead of 1 on both sides).

It sits next to the Chrono (same three prey) but works differently: the Chrono undoes a big hit
after it lands and ignores small ones; the Bubble stops any hit from afar before it lands, so a
3-point burn wastes it. Engine change: one prototype hook, `onHitDefended` (a defence learns it
blocked something, to pop), plus `incomingDamageOf` told whether a hit is a bump. No ruleset-11
fight changes (ruleset fingerprint test passes).

## 3. Decision for you: the Frost

With the Bubble the Frost goes 3-2 → **4-2**, outside its shape (within 1). I tried both ways out:

- **Sturdier Bubble** (the Brawler's full 66 health): the bubble is then pure upside, 59% overall
  and 8-0, breaking Archer, Venom and Necromancer instead. Every weaker body hands the Frost the
  win first (at 22-26 bump, 59-71 health).
- **A second new ball that beats the Frost:** none found that keeps its own shape (the Leech came
  closest at 58%).

Options: **(a) add the Frost as a named exception** (4-2, "a gap for a ball that beats a slow,
sturdy bumper"); **(b) ship nothing until a Frost-beater exists.** I'd pick (a): one new soft
exception for a closed one (Bomber) and the Storm's halved.

## 4. Who gains or loses counters

| Ball   | Today | With Bubble, no Magnet | Note                                   |
| ------ | ----- | ---------------------- | -------------------------------------- |
| Bomber | 2-1   | 2-2                    | Exception closed                       |
| Storm  | 1-1   | 1-2                    | Exception halved (still 1 win)         |
| Sniper | 2-2   | 2-3                    | Fine                                   |
| Thorns | 3-3   | 3-3                    | Loses the Magnet win, gains the Bubble |
| Frost  | 3-2   | 4-2                    | **Off shape** (section 3)              |
| Magnet | 0-1   | removed                | Even-pick slot gone                    |
| Bubble | -     | 3-2                    | In shape                               |

Still open: **Titan** (1 win), **Venom** (1 win), **Berserker and Bloom** (5 wins each). Recorded
exceptions: 6 today (+ the Magnet's even pick) → 6 with (a): Bomber and the Magnet's slot closed,
the Frost added, the Storm smaller.

## 5. Whole roster (500 seeds, Bubble in, Magnet out)

| Check                  | Ruleset 11 | With Bubble             | Rule  |
| ---------------------- | ---------- | ----------------------- | ----- |
| Each ball overall      | 45.6-53.5  | 45.9-52.5               | 45-55 |
| Weakest side of a pair | 24.4       | 23.1 (Sniper vs Bubble) | 22    |
| Highest counter        | 75.2       | 76.3                    | 78    |
| Median fight           | 16.2 s     | 16.5 s                  | 12-30 |
| Draws                  | 0.5%       | 0.5%                    | <5    |
| Comebacks              | 18.6%      | 18.5%                   | 10-20 |

Not yet run: sensitivity (±5% health) and `pnpm balance` itself, which need the ball in `BALLS`
with counter-map entries (the build step).

## 6. Why not more balls: the wall

The gaps that are left all hit balls already at their limit. The Guardian (4-4), Chrono (3-4),
Vampire (2-3), Archer, Necromancer (2-3), Boomerang (3-4), Inferno (4-3) and Frost (3-2) can't take
another loss or win, and they sit in the families each gap needs:

- **Berserker and Bloom:** both win long fights against chip. So does the Guardian. Everything that
  beat them (time-escalating bumps, bumps that grow with each landed bump, armor against bumps)
  beat the Guardian as much or more (62-70%), pushing it to 4-5. The one that spared the Guardian
  (Snowball, below) failed sensitivity.
- **Titan, Storm and Venom wins:** their natural prey is a frail bumper or an anti-bump ball, and
  every anti-bump defence beats the Brawler (it hits hardest with bumps alone).

## 7. Considered and rejected (one line each)

- **Leech** (spits darts that heal it): beats the Bloom (64) and Inferno, but also the Vampire
  (70: can't drink from a shooter, 2-3 → 2-4) and loses to the Berserker (6 wins); comebacks 20.6%.
- **Snowball** (each landed bump hits harder): beats the Berserker 64-69 but ±5% health swings it
  0-3 to 6-1 (43-55% overall): fails sensitivity.
- **Ember** (bumps heat up over the match): beats Berserker and Bloom 64, but the Guardian 66-70.
- **Shell** (bumps do less to it): beats every pure bumper, Guardian, Chrono, Vampire, Brawler.
- **Bubble that also blocks bumps:** beats the Brawler 67.
- **Jelly** (no hit takes more than 20): beats the Storm 71 and the Brawler 66.
- **Ward** (hits from afar do half): beats every ball that never touches (7): too broad.
- **Wrecker** (bumps take a share of what's left): can't finish, loses to every healer (Bloom 6).
- **Hammer** (every other bump doubles) and **Glass** (cracks make later hits hurt more): a second
  Brawler, no edges.
- **Charger** (harder the longer since its last bump), **Pounce** (crouches, then lunges):
  movement-soft, and beat the Guardian or Boomerang, both at their limit.
- **Cannon** (slow heavy cannonball): the Sniper again.
- **Streak** (landed bumps build until it's hit): bumps are mutual, so its own bump resets it.

## Reproduce

```bash
node scripts/new-balls/pairs.ts --seeds 500 --balls bubble --without magnet --set bubble.bumps=0,bubble.speed=770,bubble.regrow=850,bubble.dmg=26,bubble.hp=59
```

`--all` plays every pair (the section 5 check; saved as `runs/roster-A-500.*`, and
`runs/roster-B-500.*` with the Leech). `calibrate.ts` finds the health for 50% overall;
`search.ts` tunes several balls together against the shape rule (`runs/spec-*.json`).

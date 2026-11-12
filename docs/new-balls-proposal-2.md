# New balls, round 2: proposal

> Kept for the record: the decisions are in ADR 0047 (the Spartan with a half shield, no Dodger,
> the Magnet stays). The prototype code and its measuring scripts were on the deleted branch
> `new-balls/proposal` and are not on `main`; the paths below refer to that branch.

Proposal only (branch `new-balls/proposal`). Ruleset 11. The prototypes are
`src/sim/balls/new/spartan.ts` and `dodger.ts` (not in `BALLS`); the numbers are in
`scripts/new-balls/runs/r2-final-set.txt`. The whole-roster check is 500 seeds per slot order
(`runs/r2-roster-500.*`); prototyping used 60-300.

## 1. What you need to decide

1. **Guardian: reworked into the Spartan.** It replaces the Guardian (same slot, Guardian gone).
   Removing it outright left the Sniper and Quake short of a counter each; the Spartan takes back
   most of those links (section 2).
2. **Magnet: keep.** Nothing found this round beats it without beating the Brawler too (every
   anti-bump defence and every bump-heavy ball treats them alike), so a replacement would not be
   clearly better. I still think it is the weakest design in the roster, but replacing it should
   wait for a ball that earns the slot.
3. **Two new balls, not 3-4: the Spartan and the Dodger.** Everything else failed a hard rule
   (section 5). Gaps closed: none fully (section 3). I'd rather ship two clean balls than force a
   third.
4. **The Sniper goes one counter short (1-2).** It beat the Guardian; against the Spartan it wins
   58.4%, in the grey zone. Options: **(a)** name the Sniper as a known gap (fewest 1), or **(b)** in
   the build step, push the Spartan's planted shield harder against heavy shots. I tried (b): every
   setting that lifted the Sniper over 62% also handed the Storm 70-97%. I'd pick (a).
5. **One rule to approve: poison gets round the Spartan's shield.** The shield stops hits; poison
   already inside keeps ticking. Without it the shield blocks poison ticks and the Spartan beats
   Venom 72% (Venom down to 1-3). Only Venom poisons, so it is close to a rule for one pair. Your
   call; the alternative is accepting Venom at 1-3 (inside its current allowance).

## 2. The balls

### Spartan (replaces the Guardian): "Plants its shield, then throws its spear."

A steady rhythm of about 4 s: for 2 s it plants its shield (half speed; every hit does 6 less,
never under a quarter of it), then throws its spear (24, thrown where the enemy is, no lead) and
fights in the open for 2 s. 48 health, bump 18, speed 700. On screen: a shield in front while
planted, the spear flying, the ball darting off once it's thrown.

| Beats        | Rate | Why                                                                    |
| ------------ | ---: | ---------------------------------------------------------------------- |
| Vampire      | 68.4 | Its bumps glance off the shield half the time, so it can't drink.      |
| Inferno      | 63.8 | A 3-point burn is all but stopped by a raised shield.                  |
| **Loses to** |      |                                                                        |
| Chrono       | 72.2 | The spear is a big hit: the Chrono rewinds it.                         |
| Storm        | 63.8 | A planted ball can't leave the circle, and 40 goes through 6 of armor. |

Overall 50.0%. Grey (58-62, shown even): Sniper 58.4 over it, it over Quake 59.0 and Bomber 58.1.
Gaps: **gives the Storm its second win**; with the Guardian gone, it takes the Guardian's place as
the Vampire's and Inferno's extra counter.

- **Not the Sniper:** the Sniper is a frail sharpshooter (laser lock, 27 every 2 s, 78 health, no
  defence); the Spartan is a slow brawler that spends half its time behind a shield and throws
  one spear every 4 s with no lock. They share one weakness (the Chrono rewinds both big hits) and
  no prey.
- **Not swingy:** with a fixed rhythm, the moment in the match the cycle started moved the Archer
  pair by up to 25 points, because its 4 s cycle ran in lock-step with the Archer's 2 s shots
  (`runs/r2-phase.txt`). Now each match starts the rhythm at a seeded random point, so no timer
  locks to it: changing the cycle from 240 to 250 ticks moved no pair more than 7 points, about
  what a 2-point change in overall strength does. Each fight still has timing luck (which hits
  land on the shield), as bounces do. ±5% health moves its pairs at most 6.9 points.

### Dodger (new): "Darts out of every warning circle it's in."

When it stands in an enemy circle about to strike (a lightning warning, a shockwave, an armed
bomb's blast) it turns away from the centre, a little each tick. Fire it ignores; shots and
bumps it can't see coming. 93 health, bump 20, speed 800. On screen: a quick swerve with a
speed streak when it turns away. Movement only: it never blocks or undoes a hit, which keeps it
out of the Chrono's role.

| Beats        | Rate | Why                                                             |
| ------------ | ---: | --------------------------------------------------------------- |
| Bomber       | 72.8 | It steers round armed bombs instead of running into them.       |
| Ghost        | 65.2 | Its steady bumps outlast the fade (a long fight on big health). |
| Quake        | 63.5 | It swerves out of shockwave warnings.                           |
| **Loses to** |      |                                                                 |
| Vampire      | 77.7 | A plain bumper on big health: every bump heals the Vampire.     |
| Bloom        | 68.0 | Long bump trades: the Bloom regrows between them.               |

Overall 53.1%. Grey: Speedster 61.7 for it, Necromancer 58.7, Spartan 58.3. Gaps: **gives the
Bomber its second loss**. The Ghost reason is the weakest of the five; it is a body result, not
the dodge.

## 3. Who gains or loses counters (ruleset 11 → proposal)

| Ball    | Now | With Spartan and Dodger | Note                                                               |
| ------- | --- | ----------------------- | ------------------------------------------------------------------ |
| Sniper  | 2-2 | **1-2**                 | **Off shape** (decision 4)                                         |
| Storm   | 1-1 | 2-1                     | Second win; still 1 loss (gap kept, smaller)                       |
| Bomber  | 2-1 | 1-2                     | Second loss; lost its Guardian win (gap kept)                      |
| Vampire | 2-3 | 3-4                     | Beats the Dodger, loses to the Spartan                             |
| Chrono  | 3-4 | 4-4                     | Beats the Spartan                                                  |
| Inferno | 4-3 | 4-4                     | Loses to the Spartan                                               |
| Ghost   | 2-2 | 2-3                     | Loses to the Dodger                                                |
| Quake   | 2-2 | 2-2                     | Loses to the Dodger instead of the Guardian                        |
| Bloom   | 5-2 | 5-2                     | Beats the Dodger instead of the Guardian                           |
| Others  |     |                         | Speedster 3-2, Frost 2-2, Venom 1-2, Boomerang 3-3 (Guardian gone) |

**Recorded exceptions: 6 → 6, none closed.** Storm and Bomber each gained the missing side but
lost or kept another; Titan, Venom, Berserker and Bloom are untouched. With decision 4(a) the
Sniper is a seventh. Not filled: anything that beats the Berserker and Bloom, a second win for
Titan or Venom, counters for the Magnet.

## 4. Whole roster (500 seeds; Guardian out, Spartan and Dodger in)

| Check                  | Ruleset 11 | Proposal                 | Rule  |
| ---------------------- | ---------- | ------------------------ | ----- |
| Each ball overall      | 45.6-53.5  | 45.5-53.1                | 45-55 |
| Weakest side of a pair | 24.4       | 22.3 (Dodger vs Vampire) | 22    |
| Highest counter        | 75.2       | 77.7 (Vampire vs Dodger) | 78    |
| Shapes                 | pass       | 1 off (Sniper 1-2)       | -     |
| ±5% health (new pairs) | 11.7       | 11.2 (Dodger vs Thorns)  | 15/20 |
| Median fight           | 16.2 s     | 16.2 s                   | 12-30 |
| Draws                  | 0.5%       | 0.5%                     | <5    |
| Comebacks              | 18.6%      | 18.8%                    | 10-20 |

Both edges are thin: the Dodger's Vampire pair is 0.3 inside the floor and its Bomber counter 0.8
over the 72% target. Sensitivity was measured on the new balls' pairs only (each side ±5%);
`pnpm balance` runs it for every pair once they are in `BALLS`.

## 5. Rejected (one line each)

- **Spartan, share shield on every hit:** the shield is so strong its health calibrates to 20-37,
  a glass cannon whose fights turn on which phase a hit lands in.
- **Spartan, shield on bumps only:** beats the Brawler 65-68 (even pick).
- **Spartan, leading spear:** hits nearly every throw; health falls to 21.
- **Spartan, poison and fire through the shield:** the Inferno beats it 73-80, a fifth win.
- **Spartan, fixed rhythm:** locks to the Archer's shots (25-point spread); fixed with a random start.
- **Sprinter** (sprints in warning circles): its Storm edge came from 80-115 health, not the
  sprint; at Brawler health it is a Brawler copy, and the Bloom and Vampire crush it (Bloom to 6 wins).
- **Dodger that also leaves fire:** beats the Inferno 78-99 (Inferno 4-5).
- **Shell** (bumps do less to it), retested: still loses to 6-9 balls, the Inferno and Bloom among
  them, and beats the Chrono at its limit. The Guardian wasn't its only blocker.
- **Leech**, retested: calibrates to 22 health and loses to 10 balls (Berserker 76%).
- **Charger**, retested: 1-1, soft edges (Ghost 65, Titan 63).
- **Pounce, Hammer, Glass, Wrecker, Cannon, Streak, Ward, Jelly**, retested without the Guardian:
  same failures as round 1 (Wrecker and Streak 0-6% against healers; Ward and Jelly 6-8 counters
  each way; Cannon still the Sniper again).
- **Echo** (its next bump hits as hard as the last hit it took): the Berserker in other words; not built.
- **Mirror** (sends shots back): would beat the Archer and Sniper, both at their limit; not built.
- **Aura** (hurts anything close): many small hits feed the Berserker; not built.

## Engine changes (prototype, no ruleset-11 fight changes)

On top of round 1's: the defence query is also told what dealt an ability hit (`via`, for poison).
`pnpm test` passes, including the ruleset fingerprint.

## Reproduce

```bash
node scripts/new-balls/pairs.ts --seeds 500 --all --without guardian,bubble,wrecker,hammer,cannon,jelly,ward,charger,streak,shell,snowball,ember,glass,leech,pounce,sprinter --set "$(cat scripts/new-balls/runs/r2-final-set.txt)" --out scripts/new-balls/runs/r2-roster-500.json
```

```bash
node scripts/new-balls/roster-shape.ts scripts/new-balls/runs/r2-roster-500.json
```

`sensitivity.ts` runs the ±5% health check on the new balls' pairs and `phase.ts` the Spartan's
rhythm check. `hits.ts` counts what lands in one pairing.

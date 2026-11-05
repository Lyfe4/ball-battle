# 0026: Batch 3: Magnet, Ghost, Necromancer; steering, phasing, minions

- Status: Accepted
- Date: 2026-11-05
- Amends: ADR 0002 (phased balls pass through), ADR 0005 (projectiles meet minions), ADR 0006
  (zones clear minions), ADR 0010 (counter map)

## Context

Batch 3 adds three balls. The plan gave each a mechanic and an intended counter map:

| Ball        | Mechanic                                                                 | Intended favoured   | Intended unfavoured       |
| ----------- | ------------------------------------------------------------------------ | ------------------- | ------------------------- |
| Magnet      | Periodically pulls its enemy towards itself (direction only)             | vs Archer, vs Quake | vs Thorns                 |
| Ghost       | Periodically phases: passes through balls, deals a weak spectral hit     | vs Berserker        | vs Sniper                 |
| Necromancer | Summons small skeleton minions that bounce like balls and pop on enemies | vs Sniper (decoys)  | vs Quake or Storm (areas) |

Each needed something the sim could not do: steer another ball, let balls pass through each
other, and hold a new kind of object. As in batch 2 (ADR 0015), each ball was prototyped and
measured before its counters were chosen; a planned counter the data didn't support was replaced.

## Decision

### 1. Steering: the `steer` action (the Magnet)

`{ kind: 'steer', targetId, toward, share }` turns a ball's heading towards a point: the unit
heading plus `share` of the unit direction to the point, renormalised to the ball's own speed
(`src/sim/steer.ts`, `+ − * /` and `Math.sqrt` only). It changes direction, never speed, so it
works with the cruise-speed rule (ADR 0008): a pulled ball goes exactly as fast as before.

**The pull is mutual.** The first prototype turned only the enemy. Pulled straight at the Magnet,
the enemy then hit head-on every time while the Magnet's own hits landed at random angles, so the
pull handed its enemy full-directness hits (ADR 0008) and the Magnet won 14% overall (Brawler vs
Magnet 96.5%). During a pull the Magnet now also turns towards its enemy by the same share (its
own `setVelocity`), so both meet head-on and the pull simply forces a brawl.

The Magnet pulls the nearest enemy **ball**, not minions: the pull acts on a ball, it is not an
aimed attack (§4).

### 2. Phasing: `phasedOf` (the Ghost)

A definition may declare `phasedOf(self)`, a pure query of its own state like `cruiseSpeed`.
While it is true:

- `resolveCollisions` reports an overlapping pair as a contact with `phased`, but moves nothing
  and exchanges no impulse: the balls pass through each other.
- **No contact damage either way** for that contact.
- **Only the phased ball's own `onHitBall` runs.** A pass is not a touch for the other ball, so
  on-touch effects (the Frost's slow, Venom's poison, the Storm's shock, the Speedster's cash-in)
  don't fire. That is what "takes no contact damage" means for balls whose touch is their attack.
- The Ghost's own `onHitBall` deals its **spectral hit**: ability damage (8), weaker than its
  contact hit (20), once per pass, because `contacts` keeps the overlapping pair until it parts.
- Projectiles, zones, poison and statuses are untouched: they never needed contact.
- The collision event carries `phased: true` only on a pass, so every other event is unchanged.

The pass-through margin test (ADR 0002) is unaffected: it measures closing speed, which phasing
doesn't change, and it still stands at 0.6.

### 3. Minions: a new lightweight object (the Necromancer)

`WorldState.minions` holds plain `MinionState`s (`src/sim/minions/`): id, owner, position,
velocity, radius, damage and lifetime, with ids from `nextMinionId`, so a snapshot still fully
determines the future. A hook summons one with `spawnMinion`, which does nothing once the owner
has `maxAlive`.

- **They move like balls.** Each tick a minion is folded off the walls by the same `moveBall`
  balls use, and a bounce gets the same seeded turn (`turnBounce`), drawn from the world RNG after
  the balls' draws, one per bouncing minion, in minion order. Speed is constant.
- **Swept, so they can't skip through.** A minion's path is split where it bounces and each
  straight piece is swept against each enemy ball's motion this tick, with the projectile sweep
  (ADR 0005). A minion crossing a whole ball within one tick still hits it (tested).
- **They only meet walls and enemies.** Minions pass through each other and their owner; this is
  not multi-ball collision, which stays a separate, deferred step. The frozen 0.6 pass-through
  margin is for balls and is untouched.
- **A minion pops on the first enemy ball it reaches,** dealing ability damage from its owner
  (so `onDamageDealt` fires, Thorns reflects nothing, and a phased Ghost is still hit).

**What destroys a minion** (decided here):

| Enemy attack     | Minion                                                                             |
| ---------------- | ---------------------------------------------------------------------------------- |
| Contact          | Touching an enemy ball always pops it; that pop is its hit. No other contact rule. |
| Projectile       | An enemy projectile that reaches it before any ball is used up and destroys it.    |
| Zone             | A strike destroys every enemy minion inside it.                                    |
| Poison, statuses | Don't apply: a minion has no health or statuses.                                   |
| Lifetime         | It crumbles after 10 s, a safety net that keeps the count bounded.                 |

Minions have no health: every attack that reaches one destroys it. That keeps them one hit each
and readable.

**Tick order.** After `onHitBall`: minions move and pop (9), then projectiles resolve against
balls and minions, both swept on their motion this tick (9b), then zones strike balls and clear
minions (10). The plan put minions after projectiles; moving them first lets the projectile sweep
use each minion's actual motion this tick instead of its start position.

### 4. One targeting rule for aimed attacks

`nearestTarget` (`src/sim/balls/targeting.ts`) returns the nearest enemy ball **or enemy minion**,
a tie going to the ball. The Archer, Storm and Sniper all aim with it, so every aimed attack treats
minions the same way, with no special case per ball. The renderer's `aimHeading` uses the same
function, so the Archer and Sniper visibly face, and the Sniper's laser visibly points at, the
minion they will shoot. Abilities that act on a ball rather than aim an attack (the Magnet's pull,
statuses) keep using `nearestEnemy`.

## What the measurements showed

Each ball was swept on its levers with `pnpm balance --ball <id>` (300-500 seeds), with the
mechanic switched off as a baseline.

**Magnet** (pull off vs on, at 70 health and 25 contact): the pull moved the Archer +20 points,
Sniper +21, Storm +13, Venom +13, Quake +12, Speedster +10, and the Brawler, Vampire, Frost and
Berserker by 3 or less; Thorns already beat it without a pull (reflection off a 25-damage hit).
So the pull's edge is one clear mechanism: **it beats every ball that is weak up close** (contact
damage 15 or less), and is even with the heavy hitters. Intended counters Archer, Quake and Thorns
all hold; the same mechanism adds the Speedster, Storm, Venom, Sniper and Necromancer. A smaller
pull (share 0.03 per tick instead of 0.12) keeps those soft.

**Ghost** (phase on vs off): phasing added 20-30 points against every contact ball and little or
nothing against ranged ones (Archer −4, Sniper +6, Quake +8). The gap between the two groups grows
with the share of time phased (37% phased: Brawler 65 / Archer 25 for the Ghost; 25% phased: 58 /
32). The Brawler must be even, so the Ghost phases 25% of the time (1 s of every 4 s).

- **Ghost favoured vs Berserker did not hold.** At every config the Berserker tracked the Brawler
  (even): phasing denies its rage hits exactly as it denies every contact hit, nothing more.
- **Ghost favoured vs Speedster** appeared instead, about 5 points above the Brawler at every
  config: the fastest ball passes through it most often (0.063 passes a second, the most in the
  roster) and its whole game, stacks included, is contact.
- **Sniper favoured vs Ghost** holds, as do the Archer, Storm and Quake for the same reason: none
  of their attacks needs contact. The Necromancer joins them (its minions' pops aren't contact).

**Necromancer:** with minion damage set to 0 it still won 35% against the Archer and 19% against
the Sniper (against 0-10% for every other ball), so decoys alone move those two pairs. Three
minions at once made the Archer pair 93/7; the shape that fits is **one minion at a time, summoned
often (every 88 ticks), hitting harder (13)**. Area attacks clear it: the Quake is favoured
(58.5) and the Storm is even (55.7, a strike often catches both). The Berserker is favoured too,
and that is its rage: with `RAGE_DAMAGE` 0 the Necromancer went from 42 to 67 against it. Every
minion pop is a wound, and every wound feeds the rage.

### Minion size

The plan said radius 18 (about 6 CSS px on a 375 px phone). Checked at 2× density in the phone
arena, at 18 the face collapses to a white dot with two eyes; at 26 (about 9 CSS px, 17 device px
of radius) the sockets, nose and teeth stay distinct. **Minions are 26 units**, and the
Necromancer was tuned around that size. At phone size the ring, eyes and teeth are bolder.

## Counter map for batch 3

| Pair                     | Intended    | Mechanical reason                                                       |
| ------------------------ | ----------- | ----------------------------------------------------------------------- |
| Magnet vs Speedster      | Magnet      | The pull drags it into a brawl, where its light hits lose.              |
| Magnet vs Archer         | Magnet      | The pull drags the Archer into contact, where it is weakest.            |
| Magnet vs Storm          | Magnet      | The pull drags the Storm into contact, away from its lightning's range. |
| Thorns vs Magnet         | Thorns      | The Magnet drags the spikes into itself, and every hard hit comes back. |
| Magnet vs Venom          | Magnet      | The pull forces a brawl, and Venom's light hits lose it.                |
| Magnet vs Sniper         | Magnet      | The pull drags the Sniper into contact, where it is weakest.            |
| Magnet vs Quake          | Magnet      | The pull drags the Quake away from the walls every shockwave needs.     |
| Magnet vs Necromancer    | Magnet      | The pull drags it into a brawl, where its light hits lose.              |
| Ghost vs Speedster       | Ghost       | The fastest ball runs through it most often; its rush lands on nothing. |
| Archer vs Ghost          | Archer      | Arrows never needed contact.                                            |
| Storm vs Ghost           | Storm       | Lightning never needed contact.                                         |
| Sniper vs Ghost          | Sniper      | A shot still hits it while it is phased.                                |
| Quake vs Ghost           | Quake       | Shockwaves never needed contact.                                        |
| Necromancer vs Ghost     | Necromancer | Minion pops never needed contact.                                       |
| Necromancer vs Archer    | Necromancer | A minion nearer than its owner draws the arrows.                        |
| Necromancer vs Sniper    | Necromancer | A minion nearer than its owner draws the shot.                          |
| Berserker vs Necromancer | Berserker   | Every minion pop is a wound, and every wound feeds its rage.            |
| Quake vs Necromancer     | Quake       | A shockwave clears the minion and catches the Necromancer too.          |
| All other new pairs      | Even        | The Brawler (safe pick) included; reasons in `counter-map-batch-3.ts`.  |

Replaced from the plan: Ghost > Berserker (even, see above) by Ghost > Speedster; "Quake or Storm >
Necromancer" is the Quake (the Storm is even).

## Results

`pnpm balance 500`, all fourteen balls, every new pair (both sides for an even pair, the
favoured side for the rest):

| Check | Pair                     | Intended             | Result        |
| ----- | ------------------------ | -------------------- | ------------- |
| WARN  | Brawler vs Magnet        | even                 | 50.4% / 46.5% |
| WARN  | Brawler vs Ghost         | even                 | 45.0% / 54.6% |
| ok    | Brawler vs Necromancer   | even                 | 49.6% / 50.3% |
| ok    | Magnet vs Speedster      | Magnet favoured      | 65.1%         |
| WARN  | Ghost vs Speedster       | Ghost favoured       | 59.1%         |
| ok    | Necromancer vs Speedster | even                 | 51.1% / 47.1% |
| ok    | Magnet vs Vampire        | even                 | 50.5% / 48.7% |
| NEAR  | Ghost vs Vampire         | even                 | 44.0% / 55.1% |
| ok    | Necromancer vs Vampire   | even                 | 47.7% / 52.1% |
| WARN  | Magnet vs Archer         | Magnet favoured      | 58.9%         |
| NEAR  | Archer vs Ghost          | Archer favoured      | 70.2%         |
| ok    | Necromancer vs Archer    | Necromancer favoured | 64.3%         |
| NEAR  | Magnet vs Storm          | Magnet favoured      | 57.2%         |
| WARN  | Storm vs Ghost           | Storm favoured       | 59.4%         |
| NEAR  | Necromancer vs Storm     | even                 | 43.6% / 55.7% |
| ok    | Magnet vs Frost          | even                 | 48.4% / 50.9% |
| ok    | Ghost vs Frost           | even                 | 49.7% / 49.3% |
| ok    | Necromancer vs Frost     | even                 | 48.7% / 50.8% |
| ok    | Thorns vs Magnet         | Thorns favoured      | 64.2%         |
| ok    | Ghost vs Thorns          | even                 | 49.6% / 47.8% |
| ok    | Necromancer vs Thorns    | even                 | 49.2% / 50.4% |
| ok    | Magnet vs Venom          | Magnet favoured      | 61.6%         |
| ok    | Ghost vs Venom           | even                 | 47.8% / 52.2% |
| ok    | Necromancer vs Venom     | even                 | 51.0% / 48.6% |
| ok    | Magnet vs Berserker      | even                 | 50.0% / 48.7% |
| ok    | Ghost vs Berserker       | even                 | 49.5% / 49.6% |
| NEAR  | Berserker vs Necromancer | Berserker favoured   | 57.5%         |
| ok    | Magnet vs Sniper         | Magnet favoured      | 62.4%         |
| ok    | Sniper vs Ghost          | Sniper favoured      | 61.8%         |
| WARN  | Necromancer vs Sniper    | Necromancer favoured | 59.2%         |
| NEAR  | Magnet vs Quake          | Magnet favoured      | 57.5%         |
| WARN  | Quake vs Ghost           | Quake favoured       | 58.9%         |
| WARN  | Quake vs Necromancer     | Quake favoured       | 58.5%         |
| WARN  | Magnet vs Ghost          | even                 | 46.2% / 52.6% |
| ok    | Magnet vs Necromancer    | Magnet favoured      | 63.4%         |
| NEAR  | Necromancer vs Ghost     | Necromancer favoured | 56.5%         |

No pair misses; every NEAR is inside the 2-point noise allowance (ADR 0010 addendum). Pairs among
the first eleven balls are unchanged.

Stats: **Magnet** speed 760, health 69, contact 25, a pull every 120 ticks for 36 ticks at share
0.03 a tick. **Ghost** speed 770, health 77, contact 20, phased 60 ticks of every 240 (from tick
90), spectral hit 8. **Necromancer** speed 760, health 66, contact 14, a minion every 88 ticks
(from tick 45), one at a time, radius 26, speed 640, 13 damage, 10 s lifetime.

Per ball: Brawler 47.1%, Speedster 47.3%, Vampire 50.5% (heals 36.4% of max), Archer 50.3%,
Storm 51.9%, Frost 50.6%, Thorns 48.5%, Venom 48.3%, Berserker 51.3%, Sniper 47.5%, Quake 53.0%,
Magnet 54.1%, Ghost 46.0% (16.8% of its damage spectral), Necromancer 49.3% (46.1% from minions).
Draws 0.6%, median 18.1 s, worst side 29.5%, worst ±5% sensitivity 13.7 points. Every target
passes. Mirror draws: Magnet 4.4%, Ghost 8.8%, Necromancer 0.6% (a drawn round is replayed,
ADR 0017).

## Rendering

- **Magnet:** a horseshoe in its dark accent with pale tips that glow while it pulls, and a dashed
  line from it to the ball it pulls.
- **Ghost:** a ghost's face. While phased the whole ball is drawn at 38% opacity with a broken pale
  outline (read from `phasedOf`), so a viewer sees why hits pass through. Its rings and bar stay
  solid.
- **Necromancer:** a hooded cloak with glowing eyes. **Minions:** bone-white skulls ringed in their
  owner's colour, always upright, with eye sockets, nose and teeth; a spark when one pops or is
  destroyed.
- The matchup chart's cells now shrink below 26 px when the roster needs it, so all 14 columns fit
  a 375 px phone without scrolling, and long ball names take the smaller size in the picker.

## Consequences

- Positive: three new mechanics, each tested on its own (and each test shown failing with its
  behaviour switched off). The 132 earlier known match results still come out bit-identical with
  only the two new (empty) world fields removed, so batch 3 changed no existing fight.
- Positive: gaps from ADR 0016 fill with new balls, not rules: the Sniper gains a second prey (the
  Ghost), the Quake a second predator (the Magnet), Thorns a second prey (the Magnet).
- Positive: interaction rules stay at about one per ball. Each new ball's edge is its own mechanic;
  the one cross-cutting rule, minion targeting, applies to every aimed attack alike and is visible
  in where the attack goes.
- Negative: the Magnet has many favoured matchups (every ball that is weak up close) and is the
  strongest ball overall; the Speedster gains two more unfavoured matchups (Magnet, Ghost).
- Negative: the Ghost loses to every ball with a ranged attack and is at the low end overall; a
  fourth kind of world object (minions) to keep in mind for multi-ball matches.
- Every link from ruleset 1 now shows the outdated notice (ADR 0022).

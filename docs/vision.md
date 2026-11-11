# Vision

Where BallBattle is heading. It guides design and balance decisions so today's work doesn't paint
the future into a corner. Step 1 of the planned order (best of 3 against a bot) is built
(ADR 0017); the rest is not.

## Future mode: player vs player

- Each player picks **3 balls, blind and in order**. Neither sees the other's lineup until the
  match starts.
- **Round 1** is each player's first ball against the other's first ball, round 2 the second
  balls, round 3 the third.
- **Best of 3** decides the match. It stops as soon as one player has two round wins (2-0 ends
  it; round 3 is only played at 1-1).

Every round is still an ordinary deterministic match (ADR 0001): two balls and a seed.

## The core fun: building a lineup

You build a lineup of three balls, set its order and watch the plan fight it out. Your choices set
the odds; each fight still plays out its own way. The interesting decision is a read of the
opponent: "they opened with a Speedster last time, so I'll lead with the Vampire." That only works
if matchups lean:

- Balls have **soft counters**: a counter is _favoured_, not guaranteed. Picks matter, but no
  pick is hopeless, and the fight still has to play out.
- Hard counters (a matchup that is decided before it starts) remove the reason to watch; a flat
  field (every matchup 50/50) removes the reason to pick.

## Future balance targets for this mode

These are the targets `pnpm balance` checks since the roster redesign (ADR 0045, group 4).

- Every ball has **two to four counters it wins (62% or more) and two to four it loses**, the two
  counts within one, so each has something to fear and something to hunt. **The even picks are
  the exception:** the Brawler (beats only the Ghost, loses only to Thorns) and the Magnet (loses
  only to Thorns) never lose the guess badly and never win it big.
- **No matchup worse than 22/78.**
- **Every ball wins 45-55% overall.**

### Gaps for future balls

The roster has known gaps in that shape, allowed by name in `scripts/counter-map.ts` and listed in
`docs/balance-summary.md`. Numbers can't close them (ADR 0045, group 4): each needs a ball whose
kind of hit is new. When balls are next added, these are the kinds to look for:

- **Something that beats the Storm, the Titan or the Bomber.** Only the Chrono's rewind blunts a
  big strike or blast, and only Thorns and fire hold the grown Titan. A ball that dodges or soaks
  one big hit (a shield that blocks exactly one hit, a dash out of a warning circle) would give
  each a second weakness.
- **Something Venom beats.** Poison wins only where small ticks can't be answered (the rewind). A
  ball that leans on one big heal or one big shield, which poison keeps chipping after, would give
  it a second win.
- **Something that punishes the Berserker and the Bloom.** Both beat nearly every ball that deals
  many small hits. A ball that deals one heavy hit now and then (feeding the rage once, outpacing
  regrowth) would be strong against both.
- **The Magnet is the candidate to replace.** Its pull is movement too soft to decide a pair, so it
  is an even pick by accident rather than design; a new ball filling one of the gaps above could
  take its slot.

Draws matter more in a best-of-3: a round needs a winner, and mirror matches will be common with
blind picks. See Decisions below.

## Planned order

1. **Round structure against a bot lineup, locally.** Pick 3 in order, the bot picks 3, play the
   best of 3. No network. **Done (2026-11-05, ADR 0017):** pure series logic in
   `src/sim/series.ts` that a server can re-run, a replaceable random bot, the lineup builder and
   scoreboard, and links that replay a whole series.
   - **Draft formats (2026-11-05, ADR 0019), to put the skill in picking:** _reveal, then order_
     (both lineups revealed, then each side orders its own in secret) and _loser picks next_ (the
     loser of a round picks its next ball after seeing the winner's next one; the winner keeps its
     order; replaced by Showdown, ADR 0035), next to today's blind order. Both are playable against the bot so the better one can
     be chosen by playing; which becomes the PvP default is open.
   - **Reveal takes turns (2026-11-05, ADR 0021).** Reveal-then-order turned out to give the
     player's order no value against the bot (`docs/reveal-measurements.md`). Reveal now takes turns
     showing first: round 1 the bot shows and the player answers, round 2 the player shows and the
     bot answers with its best counter, round 3 is what is left. Good play is worth about 13 points
     of series chance over bad play, and each side shows first once, so it suits PvP as it stands.
   - **A coin toss decides who shows first (2026-11-06, ADR 0029).** The bot no longer always
     leads: a seeded toss, replayed from the series seed and checked by `verifySeries`, picks who
     shows first in round 1. Good play stays worth about 12 points whoever wins it.
   - **Bot levels and Showdown (2026-11-07, ADR 0035).** The bot plays at Easy, Normal or Hard, so
     it is an opponent to read rather than a rule to learn; every choice is still seeded, in the
     link and verified. Showdown replaces Loser picks next: both open round 1 at once, then the
     winner shows first and the loser answers. Measured (`docs/series-measurements.md`): the
     levels move the series chance by 3-5 points (soft counters cap it), choices are worth 5-11
     points at every level, and Reveal keeps more skill than Showdown, so Reveal stays the main
     mode for now. Pick screens show each ball's odds against every opponent ball, never the
     bot's move.
2. **Asynchronous PvP.** Players fight other players' saved lineups. The server generates the
   seeds and can re-simulate any match to verify a reported result, which the deterministic sim
   makes cheap. Two rules for it (2026-11-05):
   - **The server issues the seed, after both players have locked in their lineups.** A client
     never picks it (today's `generateSeed` is for local play only): a seed known before lock-in
     lets a player choose a lineup for that seed, and a client-chosen seed can be rerolled until
     it gives a win.
   - **A result counts only once the server has re-simulated it** with `verifySeries`
     (ADR 0022) under the same `RULESET_VERSION` the series was played with. A result from
     another ruleset is replayed under the server's or rejected, never accepted as reported. The
     known match results checked in Chromium, Firefox and WebKit (ADR 0023) are what let a
     browser's fight and the server's re-simulation be the same fight.
3. **Progression and unlocks.** Unlocks add **variety, not power**: a new ball is a new option in
   the guessing game, never a stronger version of an old one.

## Decisions

### Aiming is dropped (2026-11-07)

- **A launch choice was tested three times, and dropped.** Aiming v1, a free launch angle
  (`docs/aiming-measurements.md`); bigger balls, to see if they rescued it
  (`docs/bigger-balls-experiment.md`); and aiming v2, a few clear launch choices, an opening strike
  and launches inside Reveal's turns (`docs/aiming-v2-experiment.md`). Every version either barely
  mattered (about 2 points, since an 18-second fight washes out the launch) or broke the counter
  map. So skill stays in the draft. Skill beyond the draft would need an input during the fight,
  which is a separate idea.

### Where the skill is (2026-11-05)

- **In picking, not in aiming.** A chosen launch direction was measured and turned out to be a
  second blind guess rather than a skill (`docs/aiming-measurements.md`, ADR 0018); bigger balls
  did not change that and broke the counter map (`docs/bigger-balls-experiment.md`). The draft
  formats of ADR 0019 move the skill into picks made with information: the opponent's lineup, or
  the winner's next ball. Reveal's first version still left no decision against the bot; it now
  takes turns showing first (ADR 0021), measured in `docs/reveal-measurements.md`.

### Counter map (2026-11-04)

- One soft triangle, which comes from the balls' mechanics: **Speedster > Archer > Vampire >
  Speedster**. Plus **Storm > Vampire** (ranged damage denies lifesteal, as the Archer's does)
  and **Speedster > Storm** (it outruns the warnings). Archer vs Storm is even.
- **The Brawler is the safe pick: even (45-55%) against every ball except Thorns** (and, since ADR
  0045 group 4, the Ghost, which it beats: a fade can't save it from a plain heavy bump). It is an
  even pick: a blind pick that never loses the guess badly and never wins it big. The counter-map
  test lists its counters exactly.
- **Thorns is the Brawler's one designed counter** (2026-11-04, ADR 0013). Reflection scales with
  the attacker's hit, so the hardest hitter hurts itself the most on the spikes. A safe pick also
  needs one known counter, so that it isn't a dominant blind pick. The counter-map test names
  Thorns explicitly as the Brawler's only non-even matchup.
- The map is data in `src/sim/counter-map-*.ts` (a bot reads it, ADR 0019); the reasoning and results are in ADR 0010.
- **Later balls** (ADR 0012-0015) each bring one favoured and one unfavoured matchup from their
  mechanics: Frost > Speedster, Storm > Frost; Venom > Thorns, Vampire > Venom; Berserker >
  Speedster, Vampire > Berserker; Speedster > Sniper, Sniper > Thorns; Quake > Speedster,
  Frost > Quake. Ranged and ability damage beating Thorns is one theme (Archer, Storm, Venom,
  Sniper); telegraphed attacks losing to the Speedster and instant ones beating it is another.
- **Counter density** (2026-11-05, ADR 0016): pair-specific interactions add Venom > Berserker
  (poison numbs rage), Berserker > Frost (it can't be slowed), Frost > Venom (the cold shortens
  poison), Archer > Frost (arrows land on the slowest ball) and Quake > Archer, Storm and Sniper
  (shockwaves stagger, and a staggered ball can't aim). Every ball but the Brawler, Thorns, the
  Sniper and the Quake now has at least two favoured and two unfavoured matchups.
- **Counter pass** (2026-11-06, ADR 0028): favoured now means 62-72%. The two invisible rules
  (rage can't be slowed, the cold shortens poison) are gone; every rule left shows a cue the moment
  it acts, and phasing is one general rule. Abilities were strengthened to sharpen counters, and
  pairs that sat between even and favoured were mapped by what they measure.
- **Rules versus new balls** (2026-11-05): counter-creating interaction rules are capped at about
  one per ball and must show on screen; the remaining gaps (a second prey for the Sniper, a second
  predator for the Quake, Thorns' 1 / 4) are for new balls to fill (ADR 0016 addendum).
- **Batch 3** (2026-11-05, ADR 0026) fills them with new balls, not rules. The **Magnet**'s pull
  forces a brawl: it beats the balls weak up close (Speedster, Archer, Storm, Venom, Sniper, Quake,
  Necromancer) and Thorns beats it. The **Ghost** phases through contact hits: it beats the
  Speedster and loses to every ball whose attack never needed contact (Archer, Storm, Sniper,
  Quake, Necromancer). The **Necromancer**'s minions draw aimed attacks: it beats the Archer and
  Sniper and loses to the Quake (a shockwave clears its minion) and the Berserker (every pop feeds
  its rage). The Sniper and Thorns gain a second prey and the Quake a second predator.
- **Batch 4** (2026-11-06, ADR 0034) adds three mechanics: the **Chrono** rewinds half a second
  once a match when knocked out, which undoes one big hit (favoured vs Speedster, Storm, Sniper;
  the Vampire and Venom are favoured over it); the **Titan** grows and gets heavier, so light
  hitters lose the trade (vs Speedster, Archer, Venom, Necromancer; Thorns and Inferno over it);
  the **Inferno** leaves burning patches (vs Ghost, Necromancer, Titan, Thorns; the Speedster and
  Archer over it). Planned counters the data didn't support (Archer and Sniper over the Titan,
  Inferno over the Frost) were replaced.
- **Batch 5** (2026-11-07, ADR 0043) adds three reusable mechanics and four balls. The
  **Boomerang**'s boomerang hits going out and coming back (vs Vampire, Ghost, Inferno; the
  Speedster, Quake, Titan, Necromancer and Bloom over it). The **Bomber**'s bombs blow when an
  enemy ball runs into one, so the fastest ball runs into most (vs Speedster; the Archer over it).
  The **Guardian**'s shield soaks part of the next hit and regrows (vs Vampire; Venom, Inferno and
  Thorns over it). The **Bloom** regrows a little after each hit if left alone (vs Boomerang,
  Necromancer, Bomber; Venom and Thorns over it). A full-block shield and uncapped regrowth were
  measured first and capped, because contact hits are rare and heavy here: a full block
  hard-countered every heavy hitter, the Brawler most of all. The Brawler stays even with all four.
- **Roster redesign** (2026-11-08, ADR 0045, `docs/roster-redesign.md`): every ball does one
  clear thing that works the same on any ball, and the three interaction rules (shock, stagger,
  numbed rage) are gone with their spark. Favoured pairs come in two bands: a kind of hit decides
  the sharp ones (72-78%), movement the softer ones (62-72%). It ships in four groups; group 1
  brings the Storm, Quake, Berserker, Vampire, Archer, Sniper and Boomerang to their new abilities.
- Replaces the first version of this decision (a second triangle, Brawler > Speedster > Storm >
  Brawler), which stat tuning could not reach: the Brawler has no ability, so nothing in its
  mechanics favours it against one ball more than another.
- Bands, checked by `pnpm balance`: the favoured side wins **58-70%**, an even pair **45-55%**
  for both sides, and **no matchup is worse than 25/75**, on top of every existing target.

### Mirror draws (2026-11-04)

Mirrors draw far more than other pairs (500 seeds: Speedster 17%, Archer 5%, Brawler 4.6%,
Storm 3.4%, Vampire 2.4%; non-mirrors 0-0.6%). Causes: two Speedster stack bonuses (ability
damage, outside the lethal tiebreak) finishing both balls in one tick, mirrored cooldowns firing
on the same tick, and equal raw contact damage.

- **Decision: replay a drawn round with a new seed** (option B), derived from the round seed and
  the attempt number so a server can regenerate and verify it. **Cap: 3 plays; if all three draw,
  a coin flip seeded from the round seed decides the round, shown as sudden death** (ADR 0017).
- **Implemented with the best-of-3 round structure** (ADR 0017). **No sim change** for draws:
  the lethal tiebreak and cooldown timing stay as they are.
- Rejected for now: a wider sim tiebreak for every same-tick mutual knockout (would resolve
  80-95% of mirror draws but changes the sim), and seeded cooldown offsets (only fixes the Archer
  and Storm pattern).

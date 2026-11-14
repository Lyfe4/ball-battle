# Vision

Where BallBattle is heading. It guides design and balance decisions so today's work doesn't paint
the future into a corner. Step 1 of the planned order (best of 3 against a bot) is built
(ADR 0017); the rest is not.

## Long-term goal

BallBattle is heading towards a real downloadable game: accounts, a backend, asynchronous and
then live PvP, leaderboards, a game currency, random unlocks and in-app purchases. Everything
below the draft (the deterministic sim, `verifySeries`, ruleset versions) is built so that this
can sit on top of it. Rules that hold however it is built:

- **Unlocks and rarities add variety, never power.** A rare ball or skin is a new option or a new
  look, never a stronger version of something a player already has; every ball stays inside the
  balance targets.
- **The server issues seeds and verifies every result with `verifySeries`.** A client never picks
  a seed and its reported result is never trusted (step 2 of the planned order below).
- **Currency and unlocks are stored on the server, never trusted from the client.** A client shows
  what the server says it owns; it never grants itself anything.
- **Paid random rewards need a legal check before shipping.** In Australia, in-game purchases with
  random rewards force at least an M rating, and simulated gambling (such as a roulette wheel)
  forces R18+. Prefer a pack or chest reveal over a roulette wheel, and check every market the game
  ships in.

Rough order:

1. Accounts and a backend.
2. Asynchronous PvP and leaderboards.
3. A free currency and unlocks earned by playing.
4. An app-store release (likely Capacitor around the web build).
5. Live PvP.
6. Paid cosmetics; paid random unlocks only after the legal check.

## Future mode: player vs player

- Each player picks **3 balls, blind and in order**. Neither sees the other's lineup until the
  match starts.
- **Round 1** is each player's first ball against the other's first ball, round 2 the second
  balls, round 3 the third.
- **Best of 3** decides the match. It stops as soon as one player has two round wins (2-0 ends
  it; round 3 is only played at 1-1).
- **Best of 5 is the planned default for ranked play against real players** (2026-11-14): five
  balls, first to three (ADR 0048), so one lucky round decides less when a rating is at stake.
  Best of 3 Reveal stays the main mode against the bot (ADR 0046), where a quick series suits.

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
  the exception:** the Brawler (beats nobody, loses only to Thorns: the plain default, ADR 0049)
  and the Magnet (loses only to Thorns) never lose the guess badly and never win it big.
- **No matchup worse than 22/78.**
- **Every ball wins 45-55% overall.**

### Gaps for future balls

The roster has known gaps in that shape, allowed by name in `scripts/counter-map.ts` and listed in
`docs/balance-summary.md`. Numbers can't close them (ADR 0045, group 4): each needs a ball whose
kind of hit is new. When balls are next added, these are the kinds to look for:

Known gaps at ruleset 14 (ADR 0049, 0050):

- **Something that beats the Storm, the Titan or the Bomber.** Only the Chrono's rewind blunts a
  big strike or blast, and only Thorns holds the grown Titan. The Storm and Bomber have two wins
  but one loss; the Titan one each. A ball that dodges or soaks one big hit (a dash out of a
  warning circle) would give each a second weakness.
- **A second win for the Sniper and the Quake, and fewer losses for the Vampire.** The Sniper
  beats only Thorns. The Spider gave the Quake its second loss (ADR 0049), but the Quake's win over
  the Chrono dropped to the grey zone in the same retune. The Vampire beats the Berserker and the
  Hex and loses to four. A ball that loses to one heavy shot, or that hits hard and rarely enough
  to lose to small shockwaves, would close these. **Closed in ruleset 13:** the Spartan's second
  win (the Hex: a small burst, halved again by its shield).
- **Fewer wins for the Berserker.** It beats five balls that hit rarely. The Hex (one burst, one
  rage) and the Frost now beat it, so it loses to four (ADR 0049), but it still needs its "up to
  five wins" allowance.
- **Five losses for the Bloom (ruleset 14, ADR 0050).** It regrows only after 2 s untouched, so
  every ball that hits it often wins: the Archer, Boomerang, Inferno, Venom and the grown Titan.
  It needs an "up to 5 losses" allowance; a ball that hits rarely but hard enough to beat it would
  take one of those places.
- **A second loss for the Ghost.** While phased nothing touches it, so a quarter of every kind of
  hit misses alike and only the Bloom beats it (ADR 0049, 0050). A ball whose hit can't be phased through
  in time (a lasting area it can't leave, say) would give it a second weakness.
- **The Brawler beats nobody (accepted).** It is the plain default, the ball to pick knowing
  nothing (ADR 0049).
- **The Magnet is the candidate to replace.** Its pull is movement too soft to decide a pair, so it
  is an even pick by accident rather than design; a new ball filling one of the gaps above could
  take its slot.
- **A ball that stuns or silences, built on the ability clock.** The Glitch (its bump switched the
  other ball's ability off) was parked in ADR 0050: on its own it turns each fight into a plain
  stat check. Its engine work is kept on `proto/bloom-glitch`: each ball keeps an ability clock
  (the match tick less the ticks its ability was off), so every cooldown, rhythm and countdown
  pauses in one place and the renderer draws paused timers paused. A future stun or silence
  should start from there, with a counter that comes from its own mechanic rather than from
  removing the other ball's.

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
3. **Progression and unlocks** (see Long-term goal). Unlocks add **variety, not power**: a new
   ball is a new option in the guessing game, never a stronger version of an old one.

## Decisions

### Aiming is dropped (2026-11-07)

- **A launch choice was tested three times, and dropped.** Aiming v1, a free launch angle
  (`docs/experiments/aiming-measurements.md`); bigger balls, to see if they rescued it
  (`docs/experiments/bigger-balls-experiment.md`); and aiming v2, a few clear launch choices, an opening strike
  and launches inside Reveal's turns (`docs/experiments/aiming-v2-experiment.md`). Every version either barely
  mattered (about 2 points, since an 18-second fight washes out the launch) or broke the counter
  map. So skill stays in the draft. Skill beyond the draft would need an input during the fight,
  which is a separate idea.

### Where the skill is (2026-11-05)

- **In picking, not in aiming.** A chosen launch direction was measured and turned out to be a
  second blind guess rather than a skill (`docs/experiments/aiming-measurements.md`, ADR 0018); bigger balls
  did not change that and broke the counter map (`docs/experiments/bigger-balls-experiment.md`). The draft
  formats of ADR 0019 move the skill into picks made with information: the opponent's lineup, or
  the winner's next ball. Reveal's first version still left no decision against the bot; it now
  takes turns showing first (ADR 0021), measured in `docs/reveal-measurements.md`.

### Counter map (2026-11-04)

- One soft triangle, which comes from the balls' mechanics: **Speedster > Archer > Vampire >
  Speedster**. Plus **Storm > Vampire** (ranged damage denies lifesteal, as the Archer's does)
  and **Speedster > Storm** (it outruns the warnings). Archer vs Storm is even.
- **The Brawler is the safe pick: even (45-55%) against every ball except Thorns** (from ADR 0045
  group 4 to ruleset 12 it also beat the fading Ghost; the phasing Ghost of ADR 0049 is even with
  it, so it beats nobody). It is an
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
- **The Hex, the Spider and the phasing Ghost** (2026-11-14, ADR 0049): the **Hex**'s bump curses,
  and 3 s later the mark bursts for a quarter of the cursed ball's full health (vs Speedster,
  Frost, Berserker, Inferno; the Vampire, Ghost, Spartan and Bloom over it). The **Spider** webs
  the walls it bounces off; a ball that bounces off a web is slowed and nipped (vs Speedster,
  Quake, Chrono; the Archer, Bomber and Bloom over it). The **Ghost** phases one second in four:
  nothing touches it then, and passing through a ball hits it (vs Venom and the Hex; the Bloom
  over it). The rules that a phased ball can't be aimed at or pulled are gone, so phasing is one
  rule. The lane fix stays parked (below).
- **The Spartan and the Bloom's pause** (2026-11-12, ADR 0047): the **Spartan** replaces the
  Guardian. It plants its shield (every hit does half, and it slows) for about 2 s, then throws its
  spear (vs Vampire; the Storm and Chrono over it). The **Bloom**'s regrowth pauses for a second
  after every hit, so it beats balls that hit rarely and loses to streams of small hits (Venom
  over it now, Venom's second win).
- **The Bloom's patient regrowth** (2026-11-14, ADR 0050): the **Bloom** regrows only after 2 s
  untouched, then 1 health every 12 ticks, and stays a closed bud while it waits (vs Frost,
  Berserker, Ghost, Chrono; the Archer, Boomerang, Inferno, Venom and Titan over it). The Titan
  goes from speed 740 to 750 to keep its one win. The Glitch, measured alongside, is parked.
- Replaces the first version of this decision (a second triangle, Brawler > Speedster > Storm >
  Brawler), which stat tuning could not reach: the Brawler has no ability, so nothing in its
  mechanics favours it against one ball more than another.
- Bands, checked by `pnpm balance` (`COUNTER_BANDS` in `scripts/counter-map.ts`; ADR 0028
  addendum, ADR 0045 group 4): a counter (▲▼) targets **65-72%** with a floor of **62-78%**, and a
  pair that wins under 62% is not a counter, however it is designed; an even pair targets
  **45-55%** for both sides with no side above **62%**, and a side over 58% is the grey zone
  (counted and warned, never failed); **no matchup is worse than 22/78**. A pair between target
  and floor is a WARN, within 2 points outside the floor a NEAR (passes), further out a MISS.

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

### Quiet stretches: the shrinking arena and Ghost phasing are dropped (2026-11-12)

- **Measured in prototypes, recorded in `docs/experiments/quiet-stretches-experiment.md`.** A shrinking
  arena cuts late quiet stretches but not the largest source (the first seconds of a fight), and
  moves 23 pairs by 8+ points (the Bloom 49.8% to 40.2%). Ghost phasing drops the Ghost from 45.4%
  to 35.1%, and the health that restores it breaks the Brawler's pinned edge over the Ghost. Both
  dropped, as are the face-off charge and a wider wall turn.
- **Kept: the lane fix** (`proto/contact-A`: no bounce leaves within 10° of the wall's
  perpendicular). It drops the Storm from 51.5% to 47.3% and puts Storm vs Chrono at 21.6/78.4.
  Measured with the Hex, Spider and Ghost (`docs/experiments/new-balls-proposal-3.md`), it knocked eight balls
  off their shape on its own, so ruleset 13 shipped without it (ADR 0049). It stays parked on
  `proto/contact-A` for a retune of its own. The Spider does more for quiet stretches: fights with
  a 10 s+ stretch with no damage fall from 32% to 4% against it.
- **Timed Ghost phasing came back in a new form** (ADR 0049): with a spectral hit as it passes
  through, the phasing Ghost is fair (50.3%) where the old phasing measured 35.1%.

# Proposal: ball looks, round 2 (prototype, not for merging)

Branch `proto/ball-looks-2`, draft PR #117. Looks only: the sim's rules, balance and rulesets are
unchanged (golden results unchanged, no `RULESET_VERSION` bump); the only `src/sim` change is the
wording below. The render reads one more thing from the world, how many of a ball's own minions are
in play (`DesignView.minionsOut`), and never writes to it.

**Review so far:** the Necromancer (A, the skull forming in its hood) and the Vampire are approved.
The Bomber is in round 3: the round-2 fuse ring was dropped (it lost the classic bomb look), and the
stick fuse itself now burns down. The wording fixes are applied.

Gallery on the deploy preview: `/ballgallery.html#bomber` (old beside new, the icon, Hold / 2� /
1� / �� and a slider, a Free play link) and `/ballgallery.html?strips` (every state at once).

## The designs

| Ball        | New look, in one sentence                                                                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bomber      | Round 3: the classic bomb and stick fuse, but the fuse burns down: whole just after a drop, shorter as the spark creeps down to the bomb, and whole again after the drop. The floor bombs are unchanged.                        |
| Necromancer | Approved: the next skull forms in its hood round its glowing eyes as the summon nears; while its skull is out the hood is empty and the eyes dim, because nothing is coming (79% of its summons raise nothing for that reason). |
| Vampire     | Approved: its fangs show its thirst: short at full health (a bump heals it nothing), longer as it loses health, with a drop of blood on each tip once a whole bump's heal would go back in (18 health or less).                 |
| Quake       | Not changed (below).                                                                                                                                                                                                            |

### The Bomber's burning fuse (round 3)

The fuse is one gentle curve from the bomb's top to near the rim, about 0.6 r long (10 px on a
phone). What is left of it is that same curve cut short exactly (no change of shape), with the
spark on its end, so it reads as one fuse burning down rather than a line shrinking. It burns over
each 3.7 s between drops; before the first drop (0.75 s in) it burns over that shorter wait, so a
fight and the manual icon open on a whole fuse. At phone size the stages read as spark near the
rim, part-way, and sitting on the bomb just before it drops (`bomber-phone.png`, the fight shots).
The floor bombs keep their own arc fuse: matching them was what made round 2's ring, and the stick
fuse reads better on the ball. The old tick flicker is gone; the spark moves only as the drop
timer runs.

### Why the Quake is dropped

Not every wall hit shocks: after a shockwave there is a 0.2 s cooldown (`COOLDOWN_TICKS` 12), and
**8.7% of wall hits** in the same measurement set nothing off (almost all the second bounce in a
corner, or a ball pinned on a wall). But the cooldown is exactly the shockwave's own warning time
(`WARNING_TICKS` 12): the Quake can shock again on the very tick its last shockwave strikes. The
warning ring already on the floor is the "not ready" signal, and a mark on the ball would just
flash for 0.2 s after every shockwave. Nothing is hidden, so I left it alone.

## Rules held

- **No size thresholds.** None of the new looks reads `simple`: one set of proportions in fractions
  of r at every size. `state-looks.test.ts` draws each look at 21 sizes
  from a small phone to a large desktop, phone and desktop detail, and requires the identical
  drawing scaled by r. Shown to fail with the Vampire switching at a size, and the Necromancer test
  with the skull-out check removed. (The Titan test's call recorder moved to `test-support.ts` so
  both share it.)
- **Nothing moves on its own.** The Bomber's old spark flickered with the tick; the new spark moves
  only as the drop timer runs. The skull and fangs follow sim state (timers, minions out,
  health). Checked in a fight with reduced motion (`fight-bomber-new-phone-reduced-*.png`); the
  gallery starts held with reduced motion.
- **Colour identity.** No ball changes its colour; new colours are ones these balls already use
  (the Bomber's spark yellow, the Necromancer's eye green and skull bone, the Vampire's heal
  crimson). Designs scale the alpha they are drawn at, so a defeated or phased ball stays
  see-through.
- **Icons match the fight.** The manual and picker icons are drawn by the same designs at a
  fight's opening state: the Bomber's fuse whole, the Necromancer's skull just starting to form,
  the Vampire sated.

## Draw cost (ADR 0063)

Each ball drawn whole by `drawBall` over 600 ticks of its gallery timeline, best of 6 passes,
Chromium, microseconds per ball per frame (`draw-cost.txt` for the Bomber's round 3; the others
from round 2):

| Ball             | Old (1x / 6x slower CPU) | New (1x / 6x)   |
| ---------------- | ------------------------ | --------------- |
| Bomber (round 3) | 2.8-3.0 / 30-33          | 3.3-3.5 / 35-36 |
| Necromancer      | 3.0-3.3 / 30-35          | 4.0 / 40-41     |
| Vampire          | 3.5-3.7 / 38-39          | 3.8-4.0 / 41-43 |

At most 10 �s more per ball at 6x, against a 2.2 ms median frame (under 0.5%).

## Descriptions against the sim (applied, text only)

Each fits in two lines on the manual page at 375 px wide (measured).

- **Vampire, description:** "Heals most of what its bumps deal, on little health." is now "Heals
  most of what its bumps deal; has little health." Its lifesteal is 90% at any health. (Round 2's
  "�; little health of its own." fits two lines at 375 but not the 12 px margin
  `manual-text.touch.browser.test.ts` keeps, so it is shortened.)
- **Necromancer, how it works:** "Every 0.9 s it raises a skull, up to 1 out at once. A skull
  bounces around and bites�" is now two rules, "Every 0.9 s, if its skull is gone, it raises a new
  one: one out at a time." and "A skull bounces around and bites the first enemy it reaches for
  11." (as one rule it wrapped to three lines).
- **Quake, description:** "Every wall hit sends out a small, wide shockwave." is now "Its wall hits
  send out small, wide shockwaves." (about 1 wall hit in 11 sends none).

## Screenshots (this folder)

- `bomber-phone.png`, `bomber-desktop.png`: every state, old above new (the `?strips` view).
- `gallery-phone.png`, `gallery-desktop.png`: the animated gallery.
- `fight-bomber-new-<phone|desktop|phone-reduced>-<moment>.png`: real Free play fights against the
  Speedster at 390 x 664 and 1280 x 800, and the phone with reduced motion.

Round 2's Necromancer and Vampire screenshots are in this folder's history (commit 877965c).

## To finish once the Bomber is approved

An ADR (and correct ADR 0071's later-look notes for these four); the style guide's states for the
three (`src/styleguide/sections*.ts`: skull out, fuse burning, thirsty). Drop `src/gallery`,
`ballgallery.html`, its `vite.config.ts` input, `scripts/proto-*` and this folder.

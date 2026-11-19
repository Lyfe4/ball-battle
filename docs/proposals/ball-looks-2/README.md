# Proposal: ball looks, round 2 (prototype, not for merging)

Branch `proto/ball-looks-2`. Looks only: no sim, ability, balance or ruleset change (nothing under
`src/sim` changed), golden results unchanged, no `RULESET_VERSION` bump. The render reads one more
thing from the world, how many of a ball's own minions are in play (`DesignView.minionsOut`), and
never writes to it.

Gallery on the deploy preview: `/ballgallery.html` (old beside new, phone and desktop size, the
icon, each ball's states played as the sim plays them, Hold / 2× / 1× / ¼× and a slider per ball,
a Free play link per look) and `/ballgallery.html?strips` (every state at once, old above new).

## The designs

| Ball        | New look, in one sentence                                                                                                                                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Necromancer | Two options (below): the next skull forms in its hood (A) or a green ring fills to the next summon (B); either way, while its skull is out the eyes dim and nothing counts down, because nothing is coming.                              |
| Bomber      | Its fuse is a yellow ring round the bomb that burns down clockwise to the next drop, the spark running back to the cap; the bomb it drops carries the same ring on the floor, burning to its blast, so the ball hands its fuse on.       |
| Vampire     | Its fangs show its thirst: short and clean at full health (a bump heals it nothing), longer as it loses health, reaching over the collar with a drop of blood on each tip once a whole bump's heal would go back in (18 health or less). |
| Quake       | Dropped from this round (below).                                                                                                                                                                                                         |

### The Necromancer: two options (pick one)

What the sim does: a summon every 0.9 s (55 ticks) from 0.75 s in, but with one skull already out
(MAX_MINIONS 1) a summon raises nothing and the timer simply restarts. Measured over every matchup
(6 seeds each), **79% of summons raise nothing** because the skull is still out. So "time to the
next skull" only means something while no skull is out, and then it is at most 0.9 s. Both options
show exactly that: eyes dim and no countdown while the skull is out; once it is gone, the
countdown appears where the timer already is (part-way, not from zero) and runs to the summon.

- **A, Skull:** a bone-white skull forms in the hood round the glowing eyes (it fades in from half
  size and grows to full), the very skull it sends out. Most thematic; the face changes most.
- **B, Ring:** the hood unchanged, and a ring in the eyes' green inside the rim fills clockwise to
  the summon. Reads more exactly as a timer, but adds a ring a little like the Bomber's.

Try each in a fight from the gallery's Free play links (`&necro=skull|ring`, kept for the tab).

### Why the Quake is dropped

Not every wall hit shocks: after a shockwave there is a 0.2 s cooldown (`COOLDOWN_TICKS` 12), and
**8.7% of wall hits** in the same measurement set nothing off (almost all the second bounce in a
corner, or a ball pinned on a wall). But the cooldown is exactly the shockwave's own warning time
(`WARNING_TICKS` 12): the Quake can shock again on the very tick its last shockwave strikes. The
warning ring already on the floor is the "not ready" signal, and a mark on the ball would just
flash for 0.2 s after every shockwave. Nothing is hidden, so I left it alone.

## Rules held

- **No size thresholds.** None of the new looks reads `simple`: one set of proportions in fractions
  of r at every size. `state-looks.test.ts` draws each look (both Necromancer options) at 21 sizes
  from a small phone to a large desktop, phone and desktop detail, and requires the identical
  drawing scaled by r. Shown to fail with the Vampire switching at a size, and the Necromancer test
  with the skull-out check removed. (The Titan test's call recorder moved to `test-support.ts` so
  both share it.)
- **Nothing moves on its own.** The Bomber's old spark flickered with the tick; the new spark moves
  only as the drop timer runs. The skull, ring and fangs follow sim state (timers, minions out,
  health). Checked in a fight with reduced motion (`fight-bomber-new-phone-reduced-*.png`); the
  gallery starts held with reduced motion.
- **Colour identity.** No ball changes its colour; new colours are ones these balls already use
  (the Bomber's floor fuse yellow, the Necromancer's eye green and skull bone, the Vampire's heal
  crimson). Designs scale the alpha they are drawn at, so a defeated or phased ball stays
  see-through.
- **Icons match the fight.** The manual and picker icons are drawn by the same designs at a
  fight's opening state: the Bomber's fuse is a fifth left (its first drop is 0.75 s in), the
  Necromancer's skull just starting to form, the Vampire sated.

## Draw cost (ADR 0063)

Each ball drawn whole by `drawBall` over 600 ticks of its gallery timeline, best of 6 passes,
Chromium, microseconds per ball per frame (`draw-cost.txt`):

| Ball            | Old (1x / 6x slower CPU) | New (1x / 6x)   |
| --------------- | ------------------------ | --------------- |
| Necromancer (A) | 3.0-3.3 / 30-35          | 4.0 / 40-41     |
| Necromancer (B) | 3.0-3.2 / 30-31          | 3.8 / 37-38     |
| Bomber          | 2.8 / 26                 | 3.7 / 35        |
| Vampire         | 3.5-3.7 / 38-39          | 3.8-4.0 / 41-43 |

At most 10 µs more per ball at 6x, against a 2.2 ms median frame (under 0.5%); round 1's Titan and
Thorns each added about 50.

## Descriptions against the sim (wording only)

- **Vampire, description** ("Heals most of what its bumps deal, on little health."): "on little
  health" means it has little health of its own (39), but reads as "heals more on little health",
  which is not so: it heals 90% of bump damage, rounded, at any health, never past full (ADR 0071's
  "worth a later look" list repeats the misreading). Suggested: "Heals most of what its bumps deal;
  little health of its own." Its how it works matches the sim.
- **Necromancer, how it works** ("Every 0.9 s it raises a skull, up to 1 out at once."): true, but
  reads as a skull every 0.9 s; 79% of summons raise nothing. Suggested: "Every 0.9 s, if its skull
  is gone, it raises a new one: one out at a time."
- **Quake, description** ("Every wall hit sends out a small, wide shockwave."): about 1 wall hit in
  11 sends none (its how it works already says "then no shockwave for 0.2 s"). Suggested: "Its wall
  hits send out small, wide shockwaves."
- **Bomber:** matches (a drop every 3.7 s, fuse 3.5 s, armed bombs set off on touch).

## Screenshots (this folder)

- `<ball>-phone.png`, `<ball>-desktop.png`: every state, old above new (the `?strips` view).
- `gallery-phone.png`, `gallery-desktop.png`: the animated gallery.
- `fight-<ball>-<look>-<phone|desktop>-<moment>.png`: real Free play fights at 390 x 664 and
  1280 x 800 (Necromancer and Vampire vs the Archer, Bomber vs the Speedster), plus the Bomber with
  reduced motion.

## To finish if adopted

Keep the chosen Necromancer look and drop the other with `src/app/necromancer-look.ts`; an ADR (and
correct ADR 0071's later-look notes for these four); the style guide's states for these three
(`src/styleguide/sections*.ts`: skull out, fuse burning, thirsty); the wording fixes if wanted.
Drop `src/gallery`, `ballgallery.html`, its `vite.config.ts` input, `scripts/proto-*` and this
folder.

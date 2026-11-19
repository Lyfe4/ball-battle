# 0072: The Necromancer, Bomber and Vampire show their state; the Quake already does

- Status: Accepted
- Date: 2026-11-19
- Amends: ADR 0026 (the Necromancer's look), ADR 0043 (the Bomber's look), ADR 0071 (its list of
  balls worth a later look)
- Builds on: ADR 0032 (Sticker Pop), ADR 0039 (the phone arena is the screen), ADR 0063 (smooth
  fights at any frame rate), ADR 0071 (the rule and round 1)

## Context

Round 2 of the rule from ADR 0071: a ball's look shows its ability and where it's up to, clearly
enough to follow mid-fight on a phone (390 × 664), and no detail appears, disappears or jumps at a
size. ADR 0071 named four balls that didn't show their state: the Necromancer (when its next skull
comes), the Bomber (when its next bomb drops), the Quake (whether its next wall hit will shock) and
the Vampire ("heals more on little health"). Each was first checked against what the sim does:

- **Necromancer:** a summon every 0.9 s (55 ticks) from 0.75 s in, but it keeps one skull at most
  (MAX_MINIONS 1), and a summon while one is out raises nothing and simply restarts the timer.
  Over every matchup (6 seeds each), 79% of its summons raised nothing for that reason. So "time to
  the next skull" means something only while no skull is out, and then it is at most 0.9 s.
- **Bomber:** a drop every 3.7 s (220 ticks), the first 0.75 s in, never skipped. Its spark
  flickered with the tick, all the time.
- **Quake:** not every wall hit shocks. After a shockwave there is a 0.2 s cooldown
  (COOLDOWN_TICKS 12), and 8.7% of its wall hits set nothing off, nearly all the second bounce in a
  corner or a ball pinned on a wall.
- **Vampire:** it does not heal more at low health. It heals 90% of what its bumps deal, rounded,
  at any health, never past full. "On little health" in its description meant it has little health
  of its own (39) and was misread, ADR 0071 included. What does change as it loses health is how
  much of a bump it can keep: at full health a bump heals it nothing, and once it is missing a
  whole bump's heal (21, at 18 health or less) all of the next one goes back in.

Prototyped on a branch with a gallery (old beside new at phone and desktop size, each ball's states
played as the sim plays them, a slider to hold one, three speeds) and reviewed twice by the owner on
an iPhone.

## Decision

Looks only: no sim, ability, balance or ruleset change, golden results unchanged.

- **Necromancer: its next skull forms in the hood.** While no skull is out, a bone-white skull fades
  in round its glowing eyes, from half size to a full face, as the summon nears: the skull it then
  sends out. While its skull is out the hood is empty and the eyes dim, since nothing is coming.
  When that skull is gone, the next one appears where the timer already is (part-grown if the
  summon is near), exactly as the sim has it. Designs can read how many of the ball's own minions
  are in play (`DesignView.minionsOut`).
- **Bomber: the stick fuse burns down.** The bomb with its stick fuse and spark, as before, but the
  fuse is whole just after a drop and burns shorter as the spark creeps down to the bomb; the bomb
  drops and the fuse is whole again. It is one curve cut short exactly (no change of shape), so it
  reads as a fuse burning, not a line shrinking. Before the first drop it burns over that shorter
  wait, so a fight and the manual icon open on a whole fuse. No flicker: the spark moves only as the
  sim's clock runs. The bombs on the floor keep their own arc fuse.
- **Vampire: its fangs show its thirst.** Thirst is how much of a whole bump's heal it could keep
  (missing health over 21, at most 1). Sated at full health, the fangs are short; they lengthen as
  it loses health and, once a whole bump would go back in, reach down over the collar with a drop of
  blood on each tip. A heal draws them back as its health returns.
- **Quake: no change.** Its cooldown (12 ticks) is exactly its shockwave's warning (WARNING_TICKS
  12): it can shock again on the very tick its last shockwave strikes. The warning ring already on
  the floor is the "not ready" signal, and a mark on the ball would only flash for 0.2 s after every
  shockwave. Nothing is hidden, so nothing is added.
- **No size thresholds.** None of the three reads `simple`: one set of proportions in fractions of
  r at every size, as the Titan in ADR 0071. `state-looks.test.ts` draws each at 21 sizes from a
  small phone to a large desktop, phone and desktop detail, and requires the identical drawing
  scaled by r (shown to fail with a part switched at a size). It shares its call recorder with
  `titan.test.ts` (`ball-designs/test-support.ts`).

The manual and picker icons are drawn by the same designs at a fight's opening, so they match the
fight. The style guide shows each state (skull forming, ready and out; fuse just dropped, half
burnt, about to drop; sated, thirsty and parched).

**Descriptions made true to the sim (wording only, no ruleset bump, ADR 0022).**

- Vampire: "Heals most of what its bumps deal, on little health." is now "Heals most of what its
  bumps deal; has little health." ("…; little health of its own." fit two lines at 375 px but not
  the 12 px margin `manual-text.touch.browser.test.ts` keeps.)
- Necromancer: "Every 0.9 s it raises a skull, up to 1 out at once." is now "Every 0.9 s, if its
  skull is gone, it raises a new one: one out at a time.", its own rule so it stays within two
  lines on a phone.
- Quake: "Every wall hit sends out a small, wide shockwave." is now "Its wall hits send out small,
  wide shockwaves."

## Tried and dropped

- **Necromancer, a summon ring:** the hood unchanged and a green ring inside the rim filling to the
  summon. Read more exactly as a timer, but the skull forming is the ball's own story; the owner
  chose the skull.
- **Bomber, a fuse ring:** the fuse wrapped round the bomb as a yellow ring burning to the drop,
  handing on to the floor bomb's matching ring. Clear, but it lost the classic bomb-with-a-fuse
  look, the ball's best feature.
- **Vampire, a first pass with a smaller range** (fangs 0.32-0.6 r, small drops): too subtle at
  phone size; the range was widened (0.28-0.7 r, wider fangs, bigger drops).

## Consequences

- **Draw cost (ADR 0063).** Each ball drawn whole by `drawBall` over its states, Chromium with the
  CPU slowed 6×, per ball per frame: the Necromancer about 40 µs (was 30-35), the Bomber about 36
  (was 30-33), the Vampire about 42 (was 38-39). At most 10 µs more each, against a 2.2 ms median
  frame.
- **Reduced motion.** The Bomber's flicker is gone; every change in the three follows sim state
  (timers, minions out, health), so reduced motion has nothing to hold still.
- **Still worth a later look:** the Spider doesn't show how many webs it has out.

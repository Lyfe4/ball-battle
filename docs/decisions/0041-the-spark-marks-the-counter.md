# 0041: The spark marks the counter, and counters say why

- Status: Accepted
- Date: 2026-11-07
- Amends: ADR 0028 (the rule cue sits on the ball that caused the rule; its words), ADR 0029 (the
  coin toss is said in the pick banner; the strip is gone), ADR 0036 (a rule gets a one-time hint)
- Amended by: ADR 0045 (the spark and the rule words are removed with the rules they marked;
  the counter reasons stay)

## Context

Three things in the game's words and marks read wrongly:

- **The spark.** When an interaction rule acted (ADR 0028) the yellow spark appeared on the ball
  it acted on: the shocked Vampire, the staggered Archer, the poisoned Berserker. It read as that
  ball doing something, when it was the other ball's ability countering it.
- **The counter reasons.** The manual said the Storm beats the Vampire because "Lightning is ranged
  damage, which lifesteal cannot answer", leaving out shock, which halves the Vampire's healing.
  The Fight! card's "What to watch" for any Brawler pair read "Safe pick: solid stats, no matchup
  decided by mechanics."
- **The coin toss.** On Reveal's round 1 the toss was a small coin reading "You" or "Bot" between
  the bar and the track. Its line of words did not show on a phone.

Rendering and text only: `src/sim`, its events, the ruleset and the golden results are unchanged.

## Decision

### 1. The spark sits on the ball whose ability caused the rule

The sim's `ruleApplied` event names only the ball the rule acted on. The render layer finds the
causer from the status the rule is about (`RULE_STATUS`, `ruleCauserId` in `render/rule-cue.ts`):
that status is still on the ball on the rule's tick (a status expires at the start of its expiry
tick), and its `sourceId` is the ball that applied it. Without a world to read (the story), the
opposing ball, since every match is one against one.

| Rule        | What it does                                               | Status    | Spark before          | Spark now |
| ----------- | ---------------------------------------------------------- | --------- | --------------------- | --------- |
| Heal cut    | a shocked ball's heals are halved (1.5 s)                  | shocked   | Vampire               | **Storm** |
| Aim held    | a staggered ball can't aim (4.5 s); a Sniper's lock breaks | staggered | Archer, Storm, Sniper | **Quake** |
| Rage numbed | poison takes 80% off the Berserker's rage bonus            | poisoned  | Berserker             | **Venom** |

The words follow it, from one module (`ui/rule-words.ts`):

- **Legend and tooltip**: "In a fight: this ball’s ability just countered the other ball".
- **How it was won**: "Storm’s shock halved Vampire’s healing.", "Quake’s shockwave stopped
  Archer aiming.", "Venom’s poison numbed Berserker’s rage."
- **A one-time hint** on the causing ball the first time a rule acts on a device: "Shock halves
  healing!", "Stagger stops aim!", "Poison numbs rage!" (the Ability hints switch, ADR 0040).
- **Descriptions** name each ball's rule (§2).

### 2. Counter reasons and descriptions name the mechanic that decides them

Every description and all 136 counter reasons were checked against the hooks.

**Measured with each rule switched off** (an in-memory experiment, 200 seeds × both slot orders,
nothing committed; input for the next counter pass):

| Pair                          | With the rule | Without it |
| ----------------------------- | ------------: | ---------: |
| Storm vs Vampire              |         66.0% |      54.5% |
| Venom vs Berserker            |         62.0% |      47.0% |
| Quake vs Archer               |         58.3% |      43.3% |
| Quake vs Sniper               |         61.8% |      44.5% |
| Quake vs Storm (an even pair) |         53.3% |      43.3% |

In each, the rule is the main reason the counter works; without it the first three would be even
pairs or turn over.

**Reasons changed** (✱ where the text and the code disagreed):

| Pair (favoured)                                              | Before                                                                      | Now                                                                 |
| ------------------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Storm vs Vampire (Storm) ✱ left out the main reason          | Lightning is ranged damage, which lifesteal cannot answer.                  | Shock halves its healing, so lifesteal can’t keep up.               |
| Venom vs Berserker (Venom) ✱ "never hits hard" overstated it | Poison numbs its rage, so it never hits hard while Venom keeps it poisoned. | Poison numbs most of its rage, so its hits barely grow.             |
| Archer vs Ghost (Archer) ✱ a phased ball can't be aimed at   | Arrows never needed contact, so phasing never stops them.                   | Arrows in flight still hit it phased; phasing only delays the next. |
| Sniper vs Ghost (Sniper)                                     | A shot still hits it while it is phased.                                    | A shot locked before it phases still hits it.                       |
| Brawler vs each of 15 (even)                                 | Safe pick: solid stats, no matchup decided by mechanics.                    | No tricks either way: plain hits decide it.                         |

The rest were accurate and kept; many run to two lines on a phone, and are left for now.

**Descriptions**, each fitting two lines in the manual at 375 px with 12 px to spare (text metrics
differ a little between systems: Linux CI wrapped one that fit on Windows). Speedster, Chrono and
Thorns were three lines; Thorns's words are unchanged in meaning.

| Ball                                                     | Now                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------- |
| Storm                                                    | Lightning every 2 s; shock halves heals. Stagger stops it.    |
| Vampire                                                  | Heals 45% of the damage it deals; shock halves that.          |
| Venom                                                    | Light hits poison for 4.5 s: it chips away and numbs rage.    |
| Berserker                                                | Huge health; hits harder as it is hurt. Poison numbs rage.    |
| Quake                                                    | Wall hits send shockwaves that stagger: no aim for 4.5 s.     |
| Archer                                                   | Leads an arrow every 2 s; frail up close. Stagger stops aim.  |
| Sniper                                                   | Locks on and fires one heavy shot; stagger breaks the lock.   |
| Ghost ✱ "nothing can aim at it", but shots in flight hit | Phases out 1 s in 4: hits, skulls, pulls and new aim miss it. |
| Speedster                                                | Wall bounces build speed and damage for its next hit.         |
| Chrono                                                   | Once a match, rewinds to undo a knockout hit.                 |
| Thorns                                                   | Spiked: every contact hit it takes hurts the attacker.        |

### 3. The coin toss is said in the pick banner

The toss strip is gone. On Reveal's round 1 the pick banner leads with the coin (the winner's name
on its face, flipped once per series, not with reduced motion) and the toss in words:

- "Coin toss: you show first." then "Pick a ball; the bot answers."
- "Coin toss: the bot shows first. It plays Magnet." then "Pick your answer."

The same banner shows in a rematch and on a desktop; the live status says the same words. On a
desktop, round 1's series bar (what is played, the gear and the `?`) now heads the left column,
as on a phone, instead of sitting below the track.

## Tests

- `render/rule-causer.test.ts` plays each rule's matchups (three seeds each) and checks the causer
  of every rule event is the expected ball and never the ball acted on; `effects-feel.test.ts`
  checks the cue lights on the causer only. Both failed before the change.
- `ui/rule-text.test.ts`: for each rule (`ui/rule-cast.ts`, checked against real matches by the
  test above), the causer's and each affected ball's description name it, as does each counter
  reason between them. Shown failing on the old text.
- `manual-text.touch.browser.test.ts`: every description fits two lines at 375 × 812, with 12 px to
  spare.
- `series-text.test.ts`: the banner and status words with the toss; the consistency flow and
  `series-result.wide` check the round 1 screen and a rematch say "Coin toss: …" (the rematch
  check failed on the old banner).

## Consequences

- Positive: the spark, the story and the descriptions all say the same thing: which ball's
  ability countered which.
- Positive: every counter a rule decides says so where a player reads it.
- Negative: a rule's spark now sits on the ball that may be far from where the effect shows (the
  heal pulse is on the Vampire, the spark on the Storm).

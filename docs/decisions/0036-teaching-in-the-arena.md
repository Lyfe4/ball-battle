# 0036: Teaching in the arena

- Status: Accepted
- Date: 2026-11-07
- Amends: ADR 0007 (the intro can run longer for the versus card), ADR 0025 (show less: tips are
  one-time, and the match story is closed by default)
- Amended by: ADR 0040 (tips are two switches in settings), ADR 0041 (a rule gets a one-time hint)

## Context

A new player who hadn't read the manual was confused during a fight about how damage was happening
and what else was going on. The sim emits an event for everything that happens, but a newcomer was
told none of it. The goal is that a first-time player understands what each ball is doing and why
someone is winning, mostly without reading anything mid-fight. Teaching happens in the arena, at
the moment things happen; reading stays optional, and experienced players are never slowed down or
nagged.

## Decision

Everything shown is read from sim events, the definitions and the counter map, so it can't
disagree with the fight. The arena's size is unchanged.

### 1. Damage events say what delivered them

Ability damage events gain an output-only `via`: `projectile`, `zone`, `zonePulse` (a lasting
zone's pulse), `minion`, `poison`, or the hook whose `damage` action dealt it (`onHitBall`,
`onDamageTaken`). Contact damage has none.

- **Why in the sim.** Reading the kind from the order of neighbouring events would misattribute
  poison that lands right after a zone's damage, which is the kind of disagreement the goal rules
  out.
- **No fight changes.** The ruleset fingerprint is unchanged. The known match results, which hash
  events, were recorded under ruleset 6 (ADR 0035) with the field already in place.
- **Not feel.** It isn't feel work in ADR 0007's sense: sim time and the fight are untouched, and
  the field only describes damage that already happened.

### 2. A source chip for damage you can't see

When poison, a burning patch's pulse or reflected spikes land, a small disc in the attacker's
colour, outlined like the health pill, pops beside the hit ball's pill and fades over 650 ms of
effect time (`source-chips.ts`). With reduced motion it only fades.

- Arrows, lightning, skulls and contact hits already show their cause, so they get no chip.
- No floating numbers (ADR 0007).

### 3. Ability hints, once per ball per device

Each definition with something to point at names its ability and the event that first shows it
(`ability: { name, shownBy }`, ADR 0024: player-facing text lives in definitions). Examples: the
Storm's `zoneSpawned` ("Lightning"), the Venom's poisoning ("Poison"), the Thorns' reflected damage
("Spikes"). The Brawler, the Berserker and the Titan have nothing discrete to point at, so they
have none.

- **When it shows.** The first time this device sees that event, a cream label ("Lightning!") pops
  above the ball's health pill for 1.6 s and follows the ball. It is a DOM overlay positioned from
  the drawn world, since the canvas draws no text.
- **One at a time.** Labels queue, so two never overlap.
- **Remembered.** Seen balls are kept in `localStorage` (`ballbattle.hintsSeen`), so a player sees
  at most 14 labels ever. If storage throws, hints show once per page load.
- **Is it annoying?** I judged not. A label is two words, appears only the first time, and never
  covers the ball.

### 4. A versus card for a player's first three matches

Over the intro, a small sticker shows both balls, the favoured ball's ▲ and the counter map's
one-line reason for the pair (a mirror says so).

- It holds the intro 1.3 s longer. That is presentation time only (ADR 0007): the same ticks run.
- A tap skips it (`skipIntro`) and the match starts at once.
- It shows for the first three matches on a device (`ballbattle.versusSeen`), then never again.
- The home screen's demo shows neither the card nor hints.

### 5. "How it was won" with key moments, instead of a live battle log

Under a finished quick match, and under each round in a series, a closed `<details>` expander:

- **Damage by source:** one stacked bar per ball, winner first. The ability is in the ball's colour
  and contact hits are paler, scaled to the larger total, with words under it ("Lightning 31 ·
  Hits 41").
- **Heals:** how much each ball healed, and how many heals shock cut.
- **Key moments:** up to four, with match times. The first time each rule acted, a rewind, the
  biggest hit (20 or more), and the knockout or "Time up".

It is computed only when opened, by replaying the match headlessly from its opening world
(`match-story-data.ts`), so it costs nothing until someone looks and is the fight itself.

**A live battle log was not built.** A scrolling list during a fight pulls the eyes off the arena,
and on a phone it either covers controls or pushes them down. The chip and the hints cover the
moment, and the key moments cover the story.

### 6. Tips can be turned off

The legend sheet (the `?` on any screen with symbols) ends with "Tips in the arena: Turn tips off ·
Show tips again". Off means no hints and no versus card. "Show tips again" also suits a device
several people share.

## Consequences

- Positive: a newcomer sees what each ball does and where damage comes from as it happens. An
  experienced player sees at most 14 hints and three versus cards, ever, and can turn them off.
- Positive: "How it was won" explains a result on request, with no extra cost or clutter.
- Negative: damage events carry one more field, and the known results had to record it.
- Negative: a player who clears site data sees the tips again.

Screenshots in `docs/images/teaching/`:

- `phone-versus-card.png`;
- `phone-hint-and-chip.png`: "Poison!" with a Thorns chip by the Venom's bar;
- `phone-how-it-was-won.png` and `desktop-how-it-was-won.png`;
- `phone-series-story-and-tips.png`: a series round's story, and the legend with the tips line.

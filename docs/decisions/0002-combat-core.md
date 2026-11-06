# 0002: Combat core — step output, collisions, damage and match end

- Status: Accepted
- Date: 2026-11-01

## Context

Step 1 had balls bouncing off walls (ADR 0001). To make a fight we need balls to collide, deal
damage, be defeated, and for every match to end with a result. Several choices here shape how
abilities, effects, sound and replays will plug in later, so they are recorded together.

## Decision

### 1. `step(world, definitions)` returns `{ world, events }`

Ball definitions are passed to `step` rather than stored in `WorldState`. Definitions may hold
functions (ability hooks), which are not serialisable, and they never change during a match.
Keeping them out keeps `WorldState` plain data that can be compared, cloned and saved. `step`
takes a `ReadonlyMap` keyed by definition id because it looks definitions up per ball.

### 2. Events are output only

Each step returns the events that happened during that tick as plain data: `collision`,
`damage`, `ballDefeated` and `matchEnded` (with a win or draw result). Within a tick they are
ordered collision → damage → ballDefeated → matchEnded.

Events never feed back into the simulation. The sim's next tick depends only on `WorldState` and
the definitions. This keeps a single source of truth: anything the sim needs to remember (health,
contacts, match state) is in `WorldState`. The renderer uses events for transient effects such as
the damage flash; sound and replays can consume the same stream later.

### 3. Collisions: discrete circle-vs-circle, positional separation, elastic impulse

After movement, every pair of live balls (in array order, for determinism) is tested for overlap.
Overlapping balls are pushed apart along the collision normal, split by inverse mass, then clamped
to the arena; if a wall stops one ball, the other takes the remaining separation. If the balls are
approaching along the normal, an elastic impulse is applied. Mass is radius squared (area).

This conserves momentum and kinetic energy and uses only `+ - * /` and `Math.sqrt`, which are
correctly rounded and identical across engines (ADR 0001). Coincident centres use a fixed fallback
normal so the result is still deterministic.

Detection is discrete: two balls can pass through each other if their relative movement in one
tick exceeds the sum of their radii (about 5000 world units per second for current sizes). Current
speeds are far below this. Fast movement abilities will need swept collision tests.

### 4. Damage once per collision, tracked in `WorldState.contacts`

`WorldState.contacts` lists the pairs of balls that were touching at the end of the previous tick.
Damage is dealt only when a pair overlaps and was not already in contact. A pair that stays in
contact across ticks (pinned against a wall, grazing, separating slowly) therefore deals damage
exactly once. Relying only on "are they approaching" would re-hit a ball pinned against a wall
every time the wall bounced it back.

On a new contact each ball deals damage to the other simultaneously. Health floors at 0. When
both hits would be lethal, the tiebreak in 4b applies.

### 4a. Damage scales with how directly a ball hits

A flat `contactDamage` exchanged on every hit makes the winner a pure function of the stats:
both balls take one hit per collision, so whichever needs fewer hits always loses, and at the
time limit the health fractions compare the same way after any number of hits. The seed would
only change how long a match takes, never who wins.

So each ball's hit is scaled by how directly it drove into the other (revised by ADR 0008; this
originally scaled by approach speed over definition speed, up to 2×):

```
multiplier = clamp(approachSpeed / |velocity|, 0.25, 1)
damage     = max(1, round(contactDamage × multiplier))
```

`approachSpeed` is the ball's velocity along the collision normal towards the other ball, and
`|velocity|` its own speed, both measured **before** the impulse, so the bounce itself never
changes the damage. Their ratio is the cosine of the approach angle: a head-on hit deals exactly
`contactDamage`, a 60° hit half, and a glancing, retreating or stationary ball a quarter. Speed
itself no longer matters (every ball keeps its own cruise speed, ADR 0008). Rounding keeps health
whole and readable, and `Math.round` is exact, so this stays deterministic. The multiplier is
reported on each `damage` event so the renderer can show heavy hits differently.

### 4b. Lethal-exchange tiebreak

With simultaneous damage, both balls often reach 0 on the same collision: most hits are
exchanged both ways, and two balls worn down together tend to finish each other. After 4a,
`pnpm balance 1000` showed 31.7% of matches ending in a draw, almost all of them mutual
knockouts. That is a poor result for a game you watch to see who wins.

So when a collision would reduce **both** balls to 0, the ball that dealt the larger raw damage
(before clamping to the target's remaining health) survives on 1 health and the other is
defeated. If both raw amounts are exactly equal, it stays a mutual knockout and a draw.

Raw damage is already a rounded whole number, so the comparison is exact and deterministic. The
survivor's `damage` event reports what actually happened (`amount` down to 1 health,
`healthAfter: 1`) and sets `survivedLethal: true`, so the renderer can show a clutch survival.
The rule lives entirely in `applyContactDamage` in `src/sim/combat.ts`; match-end logic is
unchanged, since it simply sees one ball left.

### 5. Match state and guaranteed end

`WorldState.match` is either `running` or `finished` with a result (a winner id or a draw), the
reason (`knockout` or `timeLimit`) and the end tick. Once finished, `step` returns the same world
and no events.

A ball at 0 health is defeated. It stays in the world (so the renderer can still show it) but no
longer moves or collides. If no balls are left (a mutual knockout with equal raw damage, see 4b)
the match is a draw; if one is left it wins.

Every fight must end, so a match also ends at a fixed time limit of 60 seconds of sim time
(3600 ticks). The ball with the higher health fraction (`health / maxHealth`) wins; equal fractions
are a draw. Division is correctly rounded, so equal fractions compare equal on every engine.

## Consequences

- Positive: `WorldState` stays plain data; events give the renderer, and later sound and replays,
  a clean feed without coupling them to sim internals. Matches always end, which makes headless
  balance runs (`pnpm balance`) possible.
- Negative: `step` callers must pass the same definitions every tick. Contact tracking adds a
  small amount of state. Separation is exact for two balls; with three or more, one pairwise pass
  can leave small overlaps, which will need iteration when multi-ball matches arrive.
- Ability hooks remain uncalled; their design is revisited in the next step.

## Amended by ADR 0034 (2026-11-06)

A ball brought to 0 health may still act before it is defeated: `onKnockedOut` runs for it, and
its `rewind` action can put it back in the match (the Chrono, once a match). Defeat is decided
after that phase.

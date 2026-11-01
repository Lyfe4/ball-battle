# 0003: Action-based ability system

- Status: Accepted
- Date: 2026-11-01

## Context

Balls need abilities: a Speedster that builds speed off the walls, a Vampire that heals from the
damage it deals, and later projectiles and zones. The step-1 hook types (`onTick` and
`onWallHit` returning a new `BallState`) were never called. They had two problems: a hook could
only change its own ball, and every new kind of effect would need a new return shape.

Abilities must also respect ADR 0001 (deterministic, pure simulation) and ADR 0002 (step output,
collisions, contact damage).

## Decision

### 1. Hooks return actions; `step` applies them

A hook receives a read-only context and returns a list of **actions**: plain data describing what
it wants to happen. Hooks never mutate anything; `step` applies the actions.

| Action            | Effect                                                         |
| ----------------- | -------------------------------------------------------------- |
| `damage`          | Removes health from a target (floors at 0, no lethal tiebreak) |
| `heal`            | Restores health to a target, clamped to its `maxHealth`        |
| `setVelocity`     | Replaces the hook owner's velocity                             |
| `scaleVelocity`   | Multiplies the hook owner's velocity                           |
| `setAbilityState` | Replaces the hook owner's ability state                        |

Actions on a defeated target are ignored, so a heal never revives. An unknown target id or a
non-finite velocity throws, because only a bug can produce one.

The action union is applied by one exhaustive `switch` with a `never` check. Adding a new kind
(`spawnProjectile`, `spawnZone`) means extending the union and the switch; existing balls never
return the new kinds, so they are untouched.

### 2. Hooks and where they run

| Hook            | Runs when                                                 | Context extras              |
| --------------- | --------------------------------------------------------- | --------------------------- |
| `onTick`        | Every tick, before movement                               | none                        |
| `onWallHit`     | The ball bounced off at least one wall this tick          | `bounces`                   |
| `onHitBall`     | The ball started touching another ball (new contact only) | `other`                     |
| `onDamageDealt` | After damage resolves, once per damage instance it dealt  | `target`, `amount`, `cause` |

Full tick order:

1. Finished match: return unchanged.
2. `onTick` → apply actions.
3. Move and bounce off walls.
4. `onWallHit` → apply.
5. Ball collisions (separation and impulse).
6. Contact damage for new contacts (impact scaling and lethal tiebreak, ADR 0002).
7. `onHitBall` → apply.
8. `onDamageDealt` for every damage event so far this tick, in event order → apply. Damage dealt
   by these actions does **not** fire `onDamageDealt` again, so effects can never chain or loop.
9. `ballDefeated` for every ball that went from alive to 0 health this tick.
10. Update contacts, decide whether the match is over.

Within a phase, every hook sees the same snapshot of the world taken at the start of the phase.
Hooks run in ball array order, and their actions are applied afterwards in the order returned,
ball by ball. So what one hook reads never depends on whether another hook ran first. Hooks run
only for balls alive at the start of their phase.

### 3. Typed, serialisable ability state

Each ball has `abilityState` on its `BallState`: plain serialisable data (numbers, strings,
booleans, null, arrays and objects of those), so `WorldState` stays plain data. Its initial value
comes from the definition's `initialAbilityState`.

A definition is generic over its state type, `BallDefinition<S>`, so inside a ball file the
Speedster's hooks see `ctx.self.abilityState` as `{ stacks: number }` rather than a loose record.
The world holds balls of many kinds, so storage is the erased `AbilityState`. `defineBall` is the
single place that bridges the two, with one cast. The cast is sound because a ball's state is
only ever created from its own `initialAbilityState` and replaced by its own hooks'
`setAbilityState` actions. Ability state types must be `type` aliases, because TypeScript
interfaces do not satisfy the serialisable index signature.

### 4. Randomness in hooks

`ctx.random()` returns numbers in [0, 1) from a private mulberry32 stream for that one hook call.
Its seed is an integer hash of the world's RNG state, the tick, the ball's index, the hook and a
per-tick call counter. So:

- hooks stay deterministic functions of their context, with the same seed giving the same draws;
- hooks never advance `world.rngState`, so one ball drawing numbers cannot change another ball's
  results, or anything else that uses the world RNG;
- only exact 32-bit integer maths is involved (ADR 0001).

### 5. Events for ability effects

- `damage` events carry `cause: 'contact' | 'ability'`. Ability damage reports multiplier 1.
- `healed` reports the health actually restored, only when it is above 0.
- `abilityTriggered` is emitted once per hook call that returned at least one action, just before
  that call's other events, so the renderer can show an ability firing.

## Consequences

- Positive: abilities are data in, data out, and testable in isolation. New action kinds extend
  the system without touching existing balls. The tick order is fixed and documented, so
  interactions between abilities are predictable.
- Negative: hooks can't react to each other within one phase (by design). Ability damage is
  applied after contact damage and is not part of the lethal tiebreak, so a Speedster's bonus can
  finish off a ball that survived the contact exchange on 1 health. One cast in `defineBall`
  trades a little type-system honesty for per-ball typed state.

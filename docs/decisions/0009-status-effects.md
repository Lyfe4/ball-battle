# 0009: Status effects

- Status: Accepted
- Date: 2026-11-04

## Context

Stat tuning could not make the Storm favoured against the Vampire: every stat moves all of a
ball's matchups together, and the Storm's only built-in edge (zones catch slow balls) points at
the Brawler. A counter needs a mechanic that matters against one ball more than the others. For
the Storm against the Vampire that is the obvious one: lightning stops a target from healing for
a while, and only the Vampire heals.

Frost (slows) and Venom (poisons) on the roadmap need the same thing: an effect that sits on a
ball for a while and changes what happens to it. So this is a general system with one kind
implemented, not a one-off flag for the Vampire.

## Decision

### 1. Statuses are plain data on the target

`BallState.statuses` is a list of `{ kind, sourceId, expiresTick }`. It is serialisable like the
rest of `WorldState`, so a snapshot still fully determines the future. A ball holds at most one
status of each kind. `createWorld` starts every ball with none.

`StatusKind` is an open union, `'shocked'` for now. Adding `'slowed'` or `'poisoned'` extends the
union and the code that reads that kind; balls that never apply it are untouched.

### 2. Only actions create statuses

A new action, `{ kind: 'applyStatus', targetId, status, durationTicks }`, usable by any hook
(ADR 0003). The duration is a whole number of ticks, at least 1; anything else throws, because
only a bug can produce it. As with every action, a defeated target or a defeated owner changes
nothing.

Zones can carry a status too: `spawnZone` takes an optional `status: { kind, durationTicks }`,
and a strike applies it to each ball it hits, after that ball's damage, by running an
`applyStatus` action through the same `applyActions` path that zone damage already uses. No
status ever appears any other way. Projectiles can get the same optional field when a ball needs
it (Venom arrows); it is not added before then.

### 3. Re-applying refreshes, never stacks

Applying a kind the target already has keeps one entry and sets
`expiresTick = max(current expiry, tick + durationTicks)`: a refresh can extend a status but never
shortens it. The entry's `sourceId` becomes the latest applier. Frost and Venom inherit this rule;
a status that should stack (Venom building up, say) would need its own decision.

### 4. When statuses are active and when they expire

A status applied on tick T with a duration of N ticks is active from the moment it is applied
until the end of tick T+N−1. It is removed in a new phase at the very start of tick T+N, after
the finished-match check and before `onTick`, so every hook in tick T+N already sees it gone.
Removal emits `statusExpired`.

Full tick order:

1. Finished match: return unchanged.
2. **Statuses due this tick expire.**
3. `onTick` → apply.
4. Move and bounce, with the seeded turn (ADR 0004).
5. `onWallHit` → apply.
6. Ball collisions.
7. Contact damage for new contacts.
8. `onHitBall` → apply.
9. Projectiles move and resolve (ADR 0005).
10. Zones due this tick strike: damage, then each zone's status on the balls it hit (ADR 0006).
11. `onDamageDealt` → apply.
12. Defeats.
13. Cruise speed (ADR 0008).
14. Contacts and match end.

### 5. Shocked: heals restore nothing

While a ball is shocked, `heal` actions on it restore nothing. Its health is unchanged and there
is no `healed` event: that event keeps meaning "health actually restored". Instead the sim emits
`healBlocked { ballId, sourceId, amount, status }`, where `amount` is what the heal would have
restored, so the renderer, sound and balance stats can show a lifesteal that was denied. A heal
that would have restored nothing anyway (full health) emits nothing, shocked or not.

### 6. Events

- `statusApplied { ballId, sourceId, status, expiresTick, refreshed }`, where the status lands
  (in the hook phase that applied it, or right after the zone strike's damage).
- `statusExpired { ballId, status }`, in the expiry phase.
- `healBlocked`, in place of the `healed` event the heal would have produced.

### 7. The Storm shocks

Every Storm zone carries `shocked` for `SHOCK_TICKS` (90 ticks, 1.5 s, tunable in `storm.ts`).
Every ball a strike hits is shocked; the owner and balls outside the zone are not. Against every
ball except the Vampire this changes nothing, because nothing else heals.

### 8. Rendering

A shocked ball gets a thin dashed ring just outside its edge in a pale storm blue, read from
`ball.statuses` (state, not an effect). The dashes step with the sim tick for a faint crackle and
hold still under reduced motion (ADR 0007). A blocked heal shows a short dim pulse in place of
the green heal ring.

## Consequences

- Positive: a counter that comes from a mechanic, aimed at exactly one matchup. Frost and Venom
  slot into the same state, action, refresh rule, expiry phase and events.
- Positive: matches without a Vampire replay exactly as before; only heals are affected.
- Negative: one more list per ball, one more tick phase and three more event kinds. Hooks that
  care about statuses must read `statuses` themselves; there is no generic modifier system until
  a second kind needs one.

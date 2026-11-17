# 0059: Sides, and a ball that splits in two

- Status: Accepted
- Date: 2026-11-17
- Amends: ADR 0001 (one ball a side), ADR 0003 (a new action kind)
- Prototype: `proto/spider-slime` (the split engine, measured with the Slime)

## Context

Every match is two balls, and every rule that asks "is this an enemy?" compared ball ids: a shot
skips its owner, a zone spares its owner, a ball never collides with itself. The Slime (ADR 0060)
splits in two at half health, so a side can be more than one ball, and its halves must never
touch, aim at or hurt each other.

## Decision

**A side.** `BallState.side` is the id of the ball a ball fights for; absent, a ball is its own
side (`src/sim/side.ts`: `sideOf`, `sideOfId`, `isAllyOf`). With one ball a side, as in every
match before ruleset 19, a ball's side is its id and every check is the old one: no fight moves,
and the ruleset stays at 18 with this change alone.

**Allies.** Two balls on one side never collide (`collision.ts`), and no shot, returning shot,
zone, bomb trigger or minion of one side touches its own side. Aimed attacks and pulls pick from
the other side (`nearestEnemy`, `nearestTarget`).

**The match.** A side is out when every ball on it is out. At the time limit sides are judged on
their balls' health together over the first ball's full health; the winner is named by its side
(the first ball's id), so a series reads a winner as before.

**The `split` action.** It puts a copy of its owner on the owner's side, appended after every
other ball with id `<side>~<n>`: each half steps half the spread sideways from the heading and
turns 45 degrees from it, one each way, with no trig (ADR 0001). The two healths are whole numbers
of at least 1; the new half's ability state is the action's. A split adds a `split` event.

**Once per ball (the one-split fix).** The prototype could split one ball twice: two hits in one
tick each ran `onDamageTaken` on the same unsplit snapshot (every hook in a phase sees one
snapshot), so both asked to split. `applyActions` refuses a split for a ball that has split or was
split off (`hasSplit`: it has a `side`), so a ball splits at most once whatever its hooks ask.

## Consequences

- A new action kind in the `AbilityAction` union and its exhaustive switch; tests in
  `src/sim/abilities/split.test.ts` (each seen failing with its rule disabled).
- The client shows a side as one: its health bar adds up the halves (ADR 0060).
- No ruleset change: with no ball that splits on the roster, every fight is unchanged (the golden
  results and the ruleset fingerprint pass unchanged).

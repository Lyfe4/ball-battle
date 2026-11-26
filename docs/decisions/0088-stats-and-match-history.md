# 0088: Stats and match history

- Status: Accepted (2026-11-27); built in the overnight run of 2026-11-27 (Track B)
- Date: 2026-11-27
- Builds on: ADR 0052 (series on the server, `viewOf`), ADR 0053 (live), ADR 0069 (privacy),
  ADR 0078 (Forget me), ADR 0079 (accounts, friends), ADR 0081 (Profile is accounts-only), ADR
  0084 (one read per answer), ADR 0085 (by turns), ADR 0087 (the frame, loading states)
- Leaves open: ADR 0083 (Ranks stays "Coming soon")

## Context

Profile said who you are but nothing about how you play, and the friend sheet nothing about you
and that friend. The series that would answer both are already on the server: every online series
is a row of `game.series` with its rounds and lineups. Bot series are played on the device and
never reach it.

## Decision

The owner's decisions (2026-11-26), and how they are built:

1. **Only online series count**, live and by turns. Bot games are local and never counted. A
   series counts once finished, forfeits included: a forfeit is a loss for the side that left,
   disconnected, ran out of time or missed the start (a forfeit both sides missed is a loss for
   both). A void series never counts. In SQL this is one fragment, `COUNTED`
   (`src/server/db/record.ts`): `status in ('finished', 'forfeit') and bot is null`.
2. **Accounts only.** You see your own record and history (Profile); a friend sees only your
   head-to-head with them (the friend sheet), which is their own record against you as well;
   strangers see nothing. A guest's record is refused (`not_an_account`, 403).
3. **Nothing new is stored.** Everything is read from series that exist: Delete account and
   Forget me remove it with the series rows, as today. No migration: the existing partial indexes
   `series_finished_a` and `series_finished_b` (player, `finished_at desc`, `status <> 'open'`)
   serve both reads.
4. **Ranks stays "Coming soon"** (ADR 0083).

### The reads

- **`GET /api/v1/me/record`** (`src/server/routes/record.ts`, `meRecord`): online wins, series
  played, the favourite ball (the ball in most of the player's counted lineups; a tie goes to the
  one in the most recently finished series, then by name) and the 20 most recently finished series
  (`RECENT_SERIES`): the opponent's name as the player sees it (`game.name_seen_by`; null when
  deleted), live or by turns, best of, format, won, forfeit, the score in rounds, when it finished
  and its ruleset. Types in `src/api/record.ts`.
  - **One round trip** (`sessionWith`): the session's profile (marked seen), the read counted
    against `LIMITS.reads` and the record are one statement, as the series read is (ADR 0084,
    decision 4); `round-trips.db.test.ts` checks it. A read, so no poke. `private, no-store`.
  - Only finished series are listed, and `viewOf` shows each player a finished series of theirs
    whole; the row opens the series' own screen (`?online=<id>`), which reads it through `viewOf`
    as always.
- **Head-to-head** in `GET /api/v1/friends`: each friend carries `record: {wins, losses}` (series
  won by each side, counted as above), computed in the same statement as their status
  (`friendStatuses(db, user, true)`, a lateral count per friend), absent when the two never
  finished one. The inbox, read every 30 s, never computes it.

### What the player sees

- **Profile**: a stats card (wins, played, favourite ball) and "Recent matches" rows (opponent,
  Won or Lost, score, date, live or by turns, "›"), each opening the finished series' screen with
  Watch again. A series whose ruleset doesn't replay here (`replaysHere`: not today's ruleset nor
  in `SAME_FIGHTS_AS`) shows its result and one line that it was played on an older version of the
  game, without Watch again.
- **The friend sheet**: "You 3 – 2 Jo" under the name; nothing when you never played.
- **Privacy**: `privacy.html` says friends see your record with them.

## Consequences

- Profile costs one more function call per visit (one round trip); the Friends list's statement
  does a little more work per friend, bounded by the friend cap.
- A player who deletes their account takes their series with them only where both sides are gone;
  in the other player's history they show as "Deleted player" (ADR 0052), as on home today.
- Ranked (ADR 0083) can reuse `COUNTED` and the record's shape when it lands.

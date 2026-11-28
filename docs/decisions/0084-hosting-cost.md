# 0084: Hosting cost: the legacy free plan until a trigger, then Netlify Pro in Sydney

- Status: Accepted (2026-11-25), the owner's answers to `docs/hosting-cost-proposal.md` section 8.
  Built: the series read in one query and the pick in two (decision 4).
- Date: 2026-11-25
- Amended by: ADR 0089 (addendum: All matches, a page at a time)
- Amends: ADR 0052 (section 11, decision 6: "Move to Personal when the first functions go live in
  production" is replaced by the triggers below; "Cost, roughly" is superseded by the proposal's
  measured figures)
- Builds on: `docs/hosting-cost-proposal.md` (the measurements, the limits, the options and their
  monthly cost), ADR 0053 (adaptive polling), ADR 0082 (pokes, and its legacy-plan addendum)

## Context

The site is on Netlify's legacy free plan, which counts function calls (125,000 a month, the
whole site stops past it) and not their length. With pokes on, a player costs about 63 calls a
day in production-shaped play and about 140 once friends ship, so the plan holds about 64 and 29
daily players. Every call waits ~0.6 s on the Ohio↔Sydney round trips; free on the legacy plan,
about 90% of a call's credits on any credit plan, which is why leaving the legacy plan early would
lower the ceiling. Leaving it is permanent.

## Decision

1. **Stay on the legacy free plan** until either trigger:
   - a month passes **75,000 function calls** (60% of 125k), or
   - **accounts are about to go live in production** (friends' Mix F reaches 125k at ~29 daily
     players, too close to wait for the count).
2. **Then Netlify Pro ($20) with functions in Sydney (`syd`)**, in that week: `netlify.toml`'s
   region, `privacy.html` and its date in the same pull request, and `scripts/live-measure.ts`
   before and after. **Players are mainly in Australia**, so the database stays in Sydney (the
   proposal's option F, the database moved to the US, is not taken).
3. **Keep the 2 s live heartbeat** for now (about 75% of a match's calls; revisit at the trigger or
   if the count runs high).
4. **Fewer queries per request now** (built with this ADR): a warm series read is one query (the
   session's profile read in the series statement, `sessionWith`) and a pick two
   (`round-trips.db.test.ts`). No call saved, so nothing on the legacy bill; ~190 ms off every live
   read today, and credits later.
5. **Watch the count:** once production has online play, read Netlify's Usage page (Functions)
   weekly and note the month's calls beside the estimate (63 / 140 a player-day). The runtime limit
   and the real monthly count are read on the dashboard (owner).

Not taken: Edge Functions, Postgres RPC from the browser, Cloudflare Workers (proposal section 7:
not before ~1,500 daily players or live ranked at scale), Fly.io.

## Consequences

- Nothing changes in hosting today; the move to Pro is a planned step with two named triggers.
- ADR 0083's ranked ships after accounts are in production, so ranked arrives on Pro in Sydney.
- Supabase stays on Free until its own trigger (the proposal's ~600-800 daily players for Realtime,
  or ADR 0052's launch plan for backups); the daily check now warns at 300 MB (ADR 0083).

## Addendum (2026-11-27): All matches, a page at a time (ADR 0089)

Profile's one read (`/me/record`, ADR 0088) now also carries "Your stats" and the cursor after its
20 matches, in the same statement: still one call and one round trip per Profile visit. The rest
of the history is `GET /api/v1/me/matches?after=<cursor>` (the same function as the record, so no
second cold start), one statement and one counted read (`LIMITS.reads`) per page of 20, keyset on
`(finished_at, id)` over the existing `series_finished_a` / `series_finished_b` indexes. A page is
read only when a player opens All matches and scrolls past what the record already holds; a
player with 20 or fewer matches never asks for one. Against the estimate (63 / 140 calls a
player-day) this is noise: a page is a deliberate scroll, not a poll, and nothing reads it in the
background.

## Addendum (2026-11-29): reads counted one in ten (proposed, after launch)

Every counted read upserted its rate-limit row: about one write a second per player in a live
match, and most of a daily player's database writes (the 2026-11-28 audit, "every read writes a
row"). Now one read in ten (`READ_SAMPLE`, the server's own `crypto` randomness) adds ten, and the
other nine only read the window's count in the same statement, with no write (`read-count.ts`,
`countedAs`). The count is the same on average, so the 900-per-5-minutes limit holds; and a read
that only looks is still refused once the window is over, so a loop is stopped on every request,
not one in ten. No extra round trip: the read and its count stay one statement (the series and
record reads) or one query (the rest).

- Writes saved: about 90% of rate-limit writes. A typical daily player with friends makes about
  140 calls a day (Mix F above), nearly all counted reads; about 125 upserts become about 13.
- Honest players: 500 reads in 5 minutes counts 500 ± 67, so reaching 900 is a six-sigma event.
- Picks keep counting against `moves` exactly (weight 1), and every other limit is unchanged.
- Tests set `Deps.readWeight` to 1 (exact counts); `read-count.db.test.ts` checks 0 and 10 on all
  three ways a read is counted, and fails if a look skips the window's count.
- Not changed: the seen mark and the live heartbeat's presence write (they are the game's state).

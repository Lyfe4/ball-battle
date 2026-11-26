# 0084: Hosting cost: the legacy free plan until a trigger, then Netlify Pro in Sydney

- Status: Accepted (2026-11-25), the owner's answers to `docs/hosting-cost-proposal.md` section 8.
  Built: the series read in one query and the pick in two (decision 4).
- Date: 2026-11-25
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

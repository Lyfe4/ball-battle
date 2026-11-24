# 0083: Ranked play: trophies over a hidden Glicko-2, by turns first

- Status: Accepted (2026-11-25), approved by the owner from `docs/ranked-proposal.md` with the
  answers to its section 14 below (decision 5 declined, decision 8 changed). Building: PR 2 (the
  rating maths) and PR 3 (the schema), nothing a player sees. Ranked ships to players only once
  accounts and pokes are on in production (decision 10).
- Date: 2026-11-25
- Amends: ADR 0052 ("Ranked PvP": the rating is hidden and trophies are shown, the board's sort,
  the season reset, "not the same opponent within 24 hours" becomes a pair cap; pruning), ADR 0081
  (the Ranks tab's three cards become the league card and two boards; Ranked joins the Play sheet's
  Against row)
- Builds on: `docs/ranked-proposal.md` (the reasoning, other games, the cost tables, the schema
  sketch and the nine-PR plan), ADR 0051 (secret seeds), ADR 0053 (live matches), ADR 0079
  (accounts, friends), ADR 0080 (starts), ADR 0082 (pokes), ADR 0084 (hosting cost)

## Context

ADR 0052 decided ranked in outline: Reveal Best of 5, signed-in players only, Glicko-2 per series,
8-week seasons, ranked-affecting balance only between seasons, a result counts only after
`verifySeries`. It left open what a player sees, how two players find each other at 10 to 50 daily
players, the Ranks tab, abuse and cost. The proposal answers those; the owner chose on 2026-11-25.

## Decision

### The owner's answers (proposal section 14)

1. **Trophies shown over a hidden Glicko-2: yes.** The rating is never shown (ADR 0052's "?" while
   RD > 110 goes). Trophies are what a player climbs; their gains lean towards the hidden rating.
2. **By turns first, live when possible: yes.** Ranked uses the series by turns already built and
   hidden (ADR 0052), and a live series when two compatible entries wait at the same moment.
3. **League names: placeholders for now** (Bronze, Silver, Gold, Crystal, Champion, Legend, a gate
   every 400 trophies). The owner names them later; the code keys leagues by index, not by name.
4. **Season reset: yes as proposed.** Hidden rating a quarter of the way to 1500, RD at least 150;
   trophies halved above Gold (800). Replaces ADR 0052's halfway with RD 250.
5. **A season's frozen ruleset for ranked: no, for now.** Ranked plays the current ruleset, and
   ranked-affecting balance waits for a season's end as ADR 0052 decided. `seasons.ruleset` records
   the ruleset a season opened on, so the server can tell when a ruleset bump would change a
   season's fights (PR 4 refuses queue joins on any other ruleset and says so on `/health`). To
   revisit once there is enough balance work to want ranked to lag it.
6. **Everyone board: shown by default, with a setting to hide** (`profiles.board_hidden`). Friends
   always see friends.
7. **One sessionless, CDN-cached route for the top 100: yes** (`GET /api/v1/ranks/top`, PR 8). It is
   the documented exception to "every route authenticates through `sessionOf`": still behind
   `guard`, no cookie read or set, `Netlify-CDN-Cache-Control` for the CDN. Whether a CDN hit counts
   as a function call is checked on staging in that PR.
8. **Pruning: no.** Every row is kept. Instead the daily check reports the database's size and
   warns at 300 MB of the free plan's 500 MB (`supabase-daily.yml`, built with PR 3).
9. **Pair cap: 2 rated series per pair per 24 h, 1 when both are on one network: yes.** Replaces
   ADR 0052's "not the same opponent within 24 hours", which would starve a queue of ten. A third
   match is skipped by the queue, never played unrated. One network is the key `network.ts` already
   uses; it is a flag for review, never a block.
10. **When: after accounts and pokes are on in production.** Groundwork (PRs 2 and 3) lands now with
    nothing visible; the player-facing PRs wait. A paid Netlify plan is decided by ADR 0084's
    triggers, before live ranked at 200+ daily players.

### The rating (proposal section 3)

- **Hidden Glicko-2** (Glickman's paper): start 1500, RD 350, volatility 0.06, τ 0.5, the
  volatility found by the Illinois method to ε = 0.000001. One rating period per finished ranked
  series (Lichess style); the result is the series (1 or 0), never the rounds.
- **Inactivity:** before each update, φ' = √(φ² + σ²·d) on the Glicko-2 scale, d the whole days
  since `last_series_at`, capped at RD 350.
- **Conservative skill** S = rating − 2·RD, stored; the board's tie-break and the matching key.
- **Trophies:** target G = max(0, 2·(S − 800)), read from the rating after the series. A win adds
  clamp(30 + (G − T)/8, 0, 60), a loss takes clamp(30 − (G − T)/8, 0, 50), rounded to whole
  trophies. The win's least is 0, not the proposal's 10 (decided while building PR 2): with 10, an
  account fed wins by a friend climbed 10 a win for ever (3,381 trophies against a target of 1,772
  after 200 fed wins); with 0 it stops about 240 above its target, and an honest player at their
  level gets under 10 on about 0.2% of wins.
- **Leagues and floors:** a gate every 400. Once a player reaches a league in a season, a loss never
  takes them below its gate (the floor is stored, so a reset that halves trophies sets it anew).
  In Bronze, a loss never takes a player below 100 and takes nothing under it, so a new player's
  first losses cost nothing.
  A forfeit, a missed turn, Leave and `start_missed` are losses. A `void` series moves nothing.
- **Code:** `src/server/rating/` (PR 2), never `src/sim`: it uses `Math.exp`, `Math.log` and
  `Math.sqrt` freely, since a rating is computed once, in one transaction, and stored.

### Finding an opponent, seasons, boards, abuse

As the proposal's sections 4 to 7, with the answers above: live for 45 s and then by turns for up to
24 h; a rating window on S that widens with the wait (live 150 + 5 a second up to 400; by turns 200 +
100 an hour, anyone after 6 h); bots fill the wait, labelled, never rated; at most 3 open ranked
series a player; 8-week seasons from Monday 00:00 Sydney; cosmetic rewards by peak league; the
Friends board (one statement over accepted friendships) and the Everyone board (10+ ranked series
this season, top 100); the double-finish guard (`rating_changes` primary key and the series row
lock, the rating update in the finishing transaction).

### Schema (PR 3, expand only)

`game.seasons`, `game.ratings`, `game.rating_changes`, `game.queue_entries`, `game.season_rewards`;
`series.season_id`; `profiles.board_hidden`; the board's partial index, the pair-cap expression
index on `series`, history and queue indexes. RLS on, no policies, schema `game` (ADR 0052). A
user's rows go with their profile (ON DELETE CASCADE); a series keeps its `season_id`.

### Build plan (the proposal's section 13, with the answers)

1. This ADR (docs only).
2. The rating maths, pure, in `src/server/rating/`, with Glickman's worked example pinned and the
   newcomer-climb and fed-account cases.
3. The schema, pinned in `schema.db.test.ts` and `scripts/supabase-tools.test.ts`; the daily
   check's database size line.
4. **Gate: a real two-phone playtest of play by turns** (24 h turns, the inbox, "Your turn") before
   ranked builds on it. It is built and tested but hidden, and nobody has played it on two phones.
   Then the server's ranked by turns: queue, matching, the finishing transaction, forfeits.
5. Pokes and the inbox for turns and results.
6. Ranked on Play (accounts builds).
7. The Ranks tab: league card and Friends board.
8. The Everyone board (`/ranks/top`), the hide-me setting, `privacy.html`.
9. Seasons closing in the sweep, then live first for 45 s.

## Consequences

- Players see one number that moves in clear steps and never a rating; two numbers live in the
  code, and tests pin how they relate (trophies settle at G).
- No ranked balance change mid-season: a ruleset bump during an open season pauses ranked joins
  until the next season opens on it. The owner may revisit decision 5.
- Nothing is pruned; the daily check watches the size. At about 1,000 daily players the free 500 MB
  fills in a few months (proposal section 11): the warning arrives before that.
- Ranked depends on accounts and pokes in production, and on the by-turns playtest.

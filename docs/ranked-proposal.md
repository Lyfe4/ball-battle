# Proposal: ranked play and leaderboards for the Ranks tab

- Status: accepted as ADR 0083 (2026-11-25), with the owner's answers there (section 14's
  decision 5 declined, decision 8 changed). Kept for the reasoning; the ADR decides.
- Builds on: ADR 0051 (secret seeds), ADR 0052 (the backend; its "Ranked PvP" and "Slice 3"
  sections are the starting point), ADR 0053 (live matches), ADR 0079 (accounts, friends),
  ADR 0080 (starts), ADR 0081 (the Ranks tab, a placeholder today), ADR 0082 (pokes).
- Amends, if accepted: ADR 0052's leaderboard sort, season reset and "same opponent within 24 hours"
  rule (section 3, 4 and 6 say why).

## In short

Ranked is Reveal Best of 5 for signed-in players with a username, as ADR 0052 decided, but played
**by turns first** (the async machine already built and hidden) and live only when someone is in the
queue at the same moment, because at 10 to 50 daily players two people are rarely online together.
One hidden **Glicko-2** rating (ADR 0052's parameters) matches players; a visible **trophy** count
with six leagues and floors is what players see and climb, and its gains lean towards the hidden
rating so trophies settle where skill is. Bots fill the wait but never count. Seasons run 8 weeks,
pull the hidden rating a quarter of the way to 1500 and halve trophies above Gold; rewards are
cosmetic (a season badge by peak league). The Ranks tab shows your league card, a Friends board
(one statement over accepted friendships) and an Everyone board (top 100, accounts with 10+
ranked series, cached at the CDN). The server already plays and verifies every series, so cheating
is limited to who plays whom: caps per pair, quitting as a loss, and flags (not blocks) for pairs on
one network. By turns costs about 11 function calls per player per series against about 110 live,
so ranked fits the 125k plan by turns up to roughly 50 daily players; live ranked at 200+ needs a
paid plan. Nine small PRs, the rating maths first.

## 1. What exists, and what is missing

| Piece                                                   | State today                                                          |
| ------------------------------------------------------- | -------------------------------------------------------------------- |
| `series.kind` `ranked`, `series.bot`                    | In the schema (`20261114213106_game_schema.sql`), never written      |
| Series by turns (Reveal Bo5, 24 h turns)                | Built and hidden (CLAUDE.md, ADR 0052 "How a series by turns plays") |
| Live series with the server clock                       | Built for friends (ADR 0053, 0080)                                   |
| Accounts, usernames, friendships, inbox                 | Built, accounts off in production (ADR 0079)                         |
| Pokes (`game.poke`, `inbox` or `match`)                 | Built behind three switches, off outside local and tests (ADR 0082)  |
| `seasons`, `ratings`, `rating_changes`, `queue_entries` | Designed in ADR 0052 section 5, **no migration**                     |
| Ranks tab                                               | Three coming-soon cards, reads nothing (ADR 0081 addendum, PR 9)     |

ADR 0052 already decided: ranked is Reveal Best of 5 (largest skill gap, 20-23 points, ADR 0048),
signed-in only, Glicko-2 per series, 8-week seasons, ranked-affecting balance only between seasons,
a result counts only after `verifySeries`. This proposal keeps all of that and fills the gaps:
what players see, how to find an opponent with few players, the tab, abuse and cost.

## 2. How other games do it

| Game            | Visible                                                                                            | Hidden                                    | Season                                                                                                     | Low-population notes                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Clash Royale    | Trophy Road to 10,000; seasonal arenas 10k-15k swing 150 a game; trophy gates you can't fall below | Not published                             | Monthly partial reset into 10k-12k; Ranked (ex Path of Legends) unlocks from last season's Champion League | Official bots only in Training Camp and Practice, with no rewards                     |
| Brawl Stars     | Trophies per brawler; Ranked in leagues Bronze to Masters, then Pro                                | Ranked is Elo-based since 2025            | Monthly: every brawler over 1,000 back to 1,000                                                            | Bot fill only reported by players                                                     |
| Marvel Snap     | Ranks 1-100 by cubes (2 a game, doubling to 8; retreat loses only what is staked; 7 cubes a rank)  | MMR used with rank and collection level   | Old reset: 30 ranks down, never below 10; floors at 10 and Infinite                                        | Bots exist, undisclosed                                                               |
| Hearthstone     | Bronze to Diamond, 10 ranks of 3 stars each, then Legend                                           | MMR never reset, always used for matching | Monthly, back to Bronze 10 with a star bonus (up to 11x) from last season                                  | Star bonus moves strong players up fast                                               |
| TFT             | Tiers and LP; top 4 never lose LP                                                                  | MMR; LP gains lean towards it             | MMR soft-reset towards the median                                                                          | 5 placement games, no LP lost                                                         |
| Super Auto Pets | Arena wins/lives, async                                                                            | -                                         | -                                                                                                          | Opponent is a team another player built on the same turn; an AI team when none exists |

What carries over: a visible number that only moves in clear steps, a hidden rating for matching,
floors so a bad evening doesn't undo a week, a soft reset rather than a wipe, and (from Super Auto
Pets) async play against other players' locked choices so nobody waits. Clash Royale is the only one
that says plainly bot games give no rewards; we copy that. Sources are in section 12.

## 3. Rating: trophies over a hidden Glicko-2

### Options

| Option                                                      | For                                                  | Against                                                                                                    |
| ----------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| A. Glicko-2 shown, "?" while RD > 110 (ADR 0052, Lichess)   | One number, honest, already decided                  | 1500 on day one means nothing to a player; a number that drops feels bad on a phone; no "road" for the tab |
| B. Trophies only (Clash Royale style, fixed ±30)            | Easy to read                                         | Matching on trophies inflates with floors; smurfs take weeks to climb                                      |
| **C. Trophies shown, Glicko-2 hidden, trophies lean to it** | A road to climb, floors, good matching from game one | Two numbers to keep straight (in the code, not for the player)                                             |

**Recommended: C.** It is what Hearthstone, Snap and TFT converge on, and it makes the trophy road
card in ADR 0081 real.

### The hidden rating (ADR 0052, unchanged)

- Glicko-2, one rating period per finished ranked series (Lichess style), result is the series
  (1 or 0), not the rounds: a 3-2 and a 3-0 count the same, so there is nothing to gain by playing
  out a lost series slowly.
- Start rating 1500, RD 350, volatility 0.06, τ 0.5 (Glickman's paper suggests τ 0.3-1.2).
- Inactivity: before each update, φ' = √(φ² + σ²·d) with d the days since `last_series_at`, capped
  at 350. In `src/server/rating/`, never `src/sim` (it needs `exp` and `log`).
- Conservative skill S = rating − 2·RD (ADR 0052's board sort, kept as the tie-break).

### Trophies (new)

- Target G = max(0, 2·(S − 800)). A new player has S = 800, so G = 0; a settled average player
  (1500, RD 70) has G ≈ 1,120; a strong one (1700, RD 70) ≈ 1,520.
- Win: T += clamp(30 + (G − T)/8, 10, 60). Loss: T −= clamp(30 − (G − T)/8, 0, 50).
  At T = G a series is ±30. Below your skill you climb up to 60 a win and lose little; above it
  you gain 10 and lose up to 50, so trophies settle at G and farming weak players stalls.
- Leagues every 400: Bronze 0, Silver 400, Gold 800, Crystal 1,200, Champion 1,600, Legend 2,000.
  Names are placeholders (decision 3).
- **Floors:** once you reach a league in a season, a loss never takes you below its gate (Clash
  Royale's trophy gates, Hearthstone's floors). Bronze has no loss below 100.
- No placement mode: the high starting RD moves G fast, so a strong newcomer climbs at +60 a win
  for the first ten or so series, which does the placement job without a separate screen.
- A forfeit (missed turn, Leave, `start_missed`) is a loss like any other. A `void` series moves
  nothing. Draws can't happen at series level.

Worked example to pin in a test (figures to compute in PR 2, these are the shape only): a new
player who wins 7 of their first 10 against settled 1500 players ends with RD near 120 and a
rating well above 1500, so G is around Crystal while T is still in Silver, and each win is near
+60 until T catches up. Glickman's own worked example (1500/200 against three opponents gives
1464.06, RD 151.52) pins the rating code.

## 4. Finding an opponent with few players

At 10 to 50 daily players, two people pressing Ranked within the same minute is rare; any design
that needs that fails quietly. The answer is the machine already built: series by turns.

### Options

| Option                                                                                                                                | Verdict                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Ranked live only, open queue                                                                                                          | Empty most of the day below ~200 daily players                                                  |
| Ranked against friends only                                                                                                           | Every pair farms the other; the friends board becomes a win-trading board                       |
| Async Blind: lock five balls and an order, the server plays it at once against another player's saved lineup (Super Auto Pets' model) | Instant and one call, but Blind's skill gap is 0 points (ADR 0035): a rating would measure luck |
| **Ranked by turns, live when possible**                                                                                               | Recommended                                                                                     |

### The recommended flow

1. Ranked is an option in the Play sheet's Against row (ADR 0081 already reserves it), accounts
   with a username only. Play with Ranked chosen opens the 5-ball lineup (Reveal Best of 5); Lock
   joins the queue with that lineup (`queue_entries`, PK `user_id`, so a double tap or a second tab
   is one entry).
2. **Live first, for 45 s.** If a compatible entry is also waiting live, both get a live series on
   the existing ADR 0053 timers. The waiting screen offers the bot (unrated) and says so.
3. **Then by turns.** After 45 s, or when the player closes the screen, the entry becomes a by-turns
   entry that waits up to 24 h. Anyone who joins later is matched with it at once and makes the
   first move; the waiting player gets an inbox poke and a "Your turn" row on Play.
4. Turns last 24 h by database time; a missed turn forfeits (ADR 0052). At most 3 open ranked
   series per player.

The skill stays Reveal's (show, answer, read), and by turns is only slower. Both kinds share one
rating, since the rules are identical; only the clock differs.

### The rating window (database time, `now() − created_at`)

- Live: |S_a − S_b| ≤ 150 + 5·seconds, capped at 400 (PlayFab and GameKit both widen by wait
  time). Using S, not rating, so an uncertain newcomer meets newcomers first.
- By turns: 200 + 100·hours; after 6 h any opponent. At 10 daily players this means "anyone",
  and the rating copes: Glicko-2 moves little for an expected result.
- Matching takes the closest S among compatible entries, then the oldest, with
  `FOR UPDATE SKIP LOCKED` in one transaction (ADR 0052's design).

### Bots

- Bots fill the wait (the Hard bot, unrated, labelled), never a ranked result: a bot win would
  give trophies for beating code anyone can read (`src/sim/bot.ts` is public), and a bot disguised
  as a player is a lie. Clash Royale gives bot games no rewards.
- The bot's own board stays ADR 0052's weekly Hard-bot streak ladder (slice 4), separate.

### Friends in ranked

- Friend challenges stay unrated (ADR 0053).
- Friends can still meet in the ranked queue. ADR 0052's "not the same opponent within 24 hours"
  starves a queue of ten people, so it becomes: **at most 2 rated series per pair per 24 h**; a
  third match between them is refused by the queue (it skips that entry), not played unrated.

## 5. Seasons

- **8 weeks** (ADR 0052), starting and ending Monday 00:00 Sydney, stored as UTC. Long enough to
  climb by turns at a few series a day; short enough for a reason to come back.
- **Ranked plays the season's ruleset.** `seasons.ruleset` pins it, and the frozen bundle plays and
  verifies it (ADR 0052 already pins a ruleset per series). Balance work keeps shipping to bot and
  friend play; ranked picks it up at the next season. This is how ADR 0052's "ranked-affecting
  changes only between seasons" becomes free instead of a freeze, **if** the client can show an
  older ruleset's lineup screen (decision 5).
- **Soft reset at the boundary** (the sweep closes the season; a series counts in the season it was
  created in):
  - hidden: rating' = rating − (rating − 1500)/4, RD' = max(RD, 150). ADR 0052 said halfway and
    RD 250; with few games per season that would throw away most of what the rating knows
    (Hearthstone never resets MMR; TFT pulls towards the median).
  - trophies: T' = T if T ≤ 800, else 800 + (T − 800)/2 (Brawl Stars and Clash Royale both keep a
    base and cut the rest).
- **Rewards, cosmetic only:** a badge for the peak league reached (shown beside the username on
  boards and in the lobby), and a court trim for Champion and Legend in that season. No currency
  until `docs/vision.md` step 4, nothing that changes a fight, nothing random (no loot-box question).
  Stored in `season_rewards`, granted by the closing sweep, once (PK).

## 6. Leaderboards

### Who appears

- Accounts with a username only (`profiles.account_at` set, `username` not null); guests never.
  The name shown is the username, never the display name or email.
- Everyone board: 10+ ranked series this season (ADR 0052), sorted by trophies, then S, then who
  got there first (`rating_changes` time).
- A setting "Show me on the Everyone board" (on by default, decision 6). Friends always see friends.
- Deleting an account cascades from `profiles`; a cached board drops them within its cache time
  (section 6 below), written in `privacy.html` with its date.

### Queries

- **Friends** (`GET /me/ranks`, with the league card): one statement, the inbox's shape:
  `select … from game.friendships f join game.ratings r on r.user_id = (case when f.low = $me then
f.high else f.low end) and r.season_id = $season where (f.low = $me or f.high = $me) and
f.accepted_at is not null`, union me, ordered by trophies. Friends lists are small; no cache,
  read on opening the tab and after a ranked result. Index: friendships' PK and `friendships_high`
  already serve it.
- **Everyone, top 100**: `select … from game.ratings where season_id = $s and series_count >= 10
order by trophies desc, skill desc limit 100`, served by a partial index
  `ratings_board (season_id, trophies desc, skill desc) where series_count >= 10`.
- **My place** when outside the top 100: `count(*) where (trophies, skill) > (mine)` on the same
  index, in `/me/ranks`.

### Caching

The top 100 is the same for everyone, so it should not cost a function call per view. Serve it from
a route with no session (`GET /ranks/top`), `Cache-Control: public, max-age=60` and
`Netlify-CDN-Cache-Control: public, s-maxage=300, stale-while-revalidate=300`, so the CDN answers
most reads without invoking the function. Two things to settle: CLAUDE.md says every route starts
with `sessionOf` (this one would be the documented exception, still behind `guard` for the method,
decision 7), and whether Netlify counts a CDN hit as an invocation (it shouldn't; verify on staging
in the PR). A 5-minute stale board is fine; your own row comes fresh from `/me/ranks`.

## 7. What a cheater can do

The server makes the seeds, holds them secret until each lock (ADR 0051 option B), runs every round
and verifies with the frozen bundle; the client reports nothing it is trusted on. So no one can
forge a result or solve a pick against the seed. What is left is **who plays whom, and how**:

| Abuse                       | Scenario                                                                      | Countermeasure                                                                                                                                               | Test                                                                                |
| --------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Win-trading                 | Two friends (or one person with two accounts) alternate wins or feed one side | 2 rated series per pair per 24 h; gains shrink as T passes G, so feeding one account tops out where its rating is; Everyone board needs 10 series            | db: a third queue match for a pair is skipped; a fed account's trophies stop near G |
| Multi-accounting / smurfing | A strong player on a new account farms Bronze                                 | Accounts need Google or an email code (counted per network, ADR 0079); high RD climbs them out in ~10 series; the window uses S so they meet other newcomers | unit: a 1,800-skill newcomer leaves Bronze within 10 wins                           |
| Same network                | Siblings on one Wi-Fi play each other                                         | **Flag, never block**: a pair on one network (the key `network.ts` already uses) gets the pair limit of 1 a day and a row in a review query                  | db: two accounts on one network, second match that day skipped                      |
| Quitting                    | Leave a losing series to save trophies                                        | Leave, a missed turn and `start_missed` are losses; disconnect grace as ADR 0053                                                                             | db: forfeit writes a loss once                                                      |
| Dodging                     | Leave the queue after seeing the match                                        | A match is a series at once, both lineups already locked; leaving it is a loss. Leaving before a match is free                                               | flow test                                                                           |
| Scripted picks              | A script reads the counter map and answers each shown ball                    | The map is public in the game (Balls tab); a script plays like the Hard bot, which a good reader beats. Accepted; no detection                               | none                                                                                |
| Seed leak                   | Learning seeds early                                                          | Commitments, the HMAC key per `key_id`, nothing sent before lock (existing tests); a series that fails verification is `void` and alerts                     | existing                                                                            |
| Double finish               | Two hosts finish the same series                                              | `rating_changes` PK `(series_id, user_id)` and the series row lock; the rating update in the same transaction                                                | db: two finishes via `elsewhere(...)`, one change                                   |

## 8. The Ranks tab

Phone first (375 px), one column, the page scrolls.

- **Accounts off (production today):** no tab (ADR 0081), unchanged.
- **Guest (accounts builds):** the league card shows "Ranked needs an account" with Sign in, then
  the Everyone board read-only (top 20, "more" for 100). No "you'd be #12" (a guest has no rating
  to place).
- **Signed in, no username:** the card asks for a username first (one tap to Profile).
- **Signed in:**
  1. League card: league mark, trophies, a bar to the next gate with its floor marked, "Season ends
     in 12 days". Play ranked (opens Play with Ranked chosen). Your turn (n) when by-turns series
     wait.
  2. Friends | Everyone switch (`.choice`, `aria-pressed`). Rows: place, league mark, username,
     trophies; your row highlighted; outside the top 100 your row is pinned below it ("#412 · you").
  3. `<details>` "Season": rewards, last season's peak, how trophies move (written from the
     constants, like "How it works").
- League marks come from `src/ui/balls/marks.ts` via `markSymbol`, with words in the accessible
  name and a legend entry. No win rates or ratings shown (house rule: "favoured", not numbers).
- Desktop (`(min-width: 64rem) and (min-aspect-ratio: 5/4)`): the league card on the left, the
  boards on the right, both in `--sheet-width` columns. No arena.
- Skeleton while `/me/ranks` loads (`skeleton.ts`); failures by `failureKindOf`.

## 9. What it needs from accounts and pokes

- **Accounts in production** (`friend-switch.ts --accounts`): ranked can't ship before them.
- `Session.account` and `username` gate the queue (`not_signed_in`, `needs_username`).
- **Pokes:** a by-turns match found or a turn passing pokes `match` for the player whose move it is;
  a ranked result pokes `inbox` so the league card refreshes. Both through row triggers with `WHEN`
  guards on the columns they read (CLAUDE.md), tested once-and-not-on-no-op in `poke.db.test.ts`.
  Without pokes (switch off) the inbox poll's 30 s carries "Your turn", which is fine at 24 h turns.
- The inbox gains a `turns` count; the read stays complete so pokes only trigger it.

## 10. Schema sketch (expand only, one migration per PR)

| Table            | Columns                                                                                                                                                                                                                  | Indexes, notes                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `seasons`        | `id` smallint PK, `name`, `ruleset` int, `starts_at`, `ends_at`, `closed_at`                                                                                                                                             | `exclude`-free: the sweep checks no overlap; one open season                                                                    |
| `ratings`        | PK `(user_id, season_id)`, `rating`, `rd`, `volatility` (double), `skill` (rating − 2·rd, stored), `trophies` int, `peak_trophies`, `floor` int, `series_count`, `wins`, `last_series_at`, `updated_at`, `on_board` bool | `ratings_board` partial index above; FK `profiles` ON DELETE CASCADE                                                            |
| `rating_changes` | PK `(series_id, user_id)`, `season_id`, before/after `rating`, `rd`, `trophies`, `result` (`win`/`loss`/`forfeit`), `created_at`                                                                                         | `(user_id, created_at desc)` for "your last 5"                                                                                  |
| `queue_entries`  | PK `user_id`, `season_id`, `ruleset`, `best_of` (5), `format` (`reveal`), `lineup` text[], `skill`, `live` bool, `live_until`, `network` text, `created_at`                                                              | `(season_id, live, created_at)`; lineup never sent                                                                              |
| `season_rewards` | PK `(user_id, season_id)`, `league`, `granted_at`                                                                                                                                                                        |                                                                                                                                 |
| `series`         | add `season_id` smallint null                                                                                                                                                                                            | expression index `(least(player_a, player_b), greatest(player_a, player_b), created_at) where kind = 'ranked'` for the pair cap |
| `profiles`       | add `board_hidden` bool default false                                                                                                                                                                                    |                                                                                                                                 |

RLS on, no policies, schema `game` (ADR 0052). Every new column nullable or defaulted; nothing
renamed or dropped; each migration pinned in `scripts/supabase-tools.test.ts`.

## 11. Cost

### Per ranked series, per player

| Path                                        | Function calls                        | Where they go                                                                                                                                |
| ------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| By turns (Reveal Bo5, ~3 sittings each)     | **≈ 11**                              | queue join 1; per sitting: open the series 1, pick 1, a poke or inbox read 1; result 1. Rounds replay in the browser from the static bundle  |
| Live (pokes on)                             | **≈ 110**                             | queue wait with a 10 s heartbeat ~5; ADR 0082's live Bo3 ≈ 66 scaled to ~4 rounds of Bo5 (match ≈ 86, picks 6, lineup 4, end 4); Ranks tab 2 |
| Live with ADR 0082's slower heartbeat (2.8) | ≈ 70                                  |                                                                                                                                              |
| Ranks tab open                              | 1 (`/me/ranks`); top 100 from the CDN |                                                                                                                                              |

Database per series: matching (one locked select, one insert), the finish (series row, 2 ratings
rows, 2 `rating_changes`, all in one transaction), `verifySeries` in the function (~25 ms for Bo5).
Storage about 3 KB a series with seeds, picks and rounds.

### Monthly, ranked only (3 series per player a day, 2 tab opens, 30 days)

The live share grows with the population, since live matching needs two people at once.

| Daily players | Live share | Calls/player/day | Calls a month | of 125k    | Storage a month |
| ------------- | ---------- | ---------------- | ------------- | ---------- | --------------- |
| 10            | 0%         | ≈ 35             | ≈ 11k         | 9%         | ~1 MB           |
| 50            | 10%        | ≈ 65             | ≈ 98k         | **78%**    | ~7 MB           |
| 200           | 50%        | ≈ 185            | ≈ 1.1M        | **890%**   | ~27 MB          |
| 1,000         | 70%        | ≈ 245            | ≈ 7.4M        | **5,900%** | ~135 MB         |

This is on top of ADR 0082's mixes (Mix F with pokes: 52k at 10 daily players, 246k at 50). So:

- **By turns is what makes ranked affordable**: ten times cheaper per series than live.
- At 50 daily players the whole game passes 125k with or without ranked; ranked by turns adds
  little to that. Live ranked at 200+ needs a paid Netlify plan, or the live loop off functions.
- At 1,000: Supabase's free 500 MB database fills in three to four months of ranked alone (keep
  `final_setup`, prune `rounds`/`picks` of finished ranked series after a season: decision 8), and
  Realtime's 200 connections are near (ADR 0082).
- If the site is on the credit plan (≈ 60k, ADR 0082 decision 1), divide the headroom by two.

## 12. Library and platform behaviour this relies on

| Library or platform                | Behaviour to rely on or guard against                                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Postgres `FOR UPDATE SKIP LOCKED`  | Skips rows another transaction holds; two joins at once can both miss each other and both wait. The second join's next read (or the sweep) retries matching                                             |
| Postgres partial index             | Used only when the query repeats the predicate (`series_count >= 10`) exactly                                                                                                                           |
| Supabase pooler (transaction mode) | One query at a time per connection (CLAUDE.md); no session state between statements, so the advisory lock is `pg_advisory_xact_lock`                                                                    |
| `now()`                            | Transaction start time: a long matching transaction sees one time; windows and season edges use it, never a host clock                                                                                  |
| Glicko-2 iteration                 | Illinois method to ε = 1e-6 (Glickman); `Math.exp`/`log` differ between engines in the last bits, fine on the server because the result is stored once, never recomputed                                |
| Netlify CDN cache                  | `Netlify-CDN-Cache-Control` is for the CDN only; a response with `Set-Cookie` or varying on cookies isn't shared: the board route must send neither. Purged on deploy. Verify a hit isn't an invocation |
| Netlify Functions                  | No memory between requests; each host matches in the database, never in memory                                                                                                                          |
| Supabase Realtime                  | Pokes lost before the first socket connects locally (memory note); the inbox read must stay complete                                                                                                    |

Real use checked: two tabs or a double tap on Lock (one entry, PK); a slow phone answering a turn
at 23:59 (deadline by `now()`, the pick's own transaction); a family on one Wi-Fi (flagged, not
blocked); usernames are ASCII by rule, so the board needs no shaping; a player who deletes their
account mid-series (`player_b` set null, the series forfeits to the other, their rating rows go).

## 13. PR plan (each into `main`, each leaves the game whole)

1. **ADR 0083** from this proposal, README row, ADR 0052 and 0081 amended. Docs only.
2. **Rating maths**: `src/server/rating/glicko2.ts`, `trophies.ts`, pure, with Glickman's worked
   example, inactivity growth, the trophy clamps and floors, the season reset; the newcomer-climb
   and fed-account cases as unit tests.
3. **Schema**: `seasons`, `ratings`, `rating_changes`, `queue_entries`, `season_rewards`,
   `series.season_id`, indexes. `schema.db.test.ts` pins them; migration pinned.
4. **Ranked by turns on the server**: queue join/leave, matching with the window and pair cap, the
   finishing transaction (verify, ratings, changes), forfeits. db tests: double finish once via
   `elsewhere`, pair cap, window by elapsed time, void moves nothing, missed turn is a loss.
5. **Pokes and inbox** for turns and results, with `poke.db.test.ts` cases (once, not on no-op).
6. **Ranked on Play** (accounts builds): the Against option, the queue screen, Your turn rows;
   `no-dead-end.test.ts`, `screenKeyOf`, history rules, a browser flow at all projects.
7. **Ranks tab, league card and Friends board** (`/me/ranks`); legend entry; four sizes.
8. **Everyone board** (`/ranks/top`, CDN-cached), the hide-me setting, `privacy.html` and its
   date; a deletion test and a cache-header test.
9. **Seasons**: the sweep closes a season, resets, grants rewards (a season row with a past
   `ends_at` stands in for time); then **live first for 45 s** once pokes are on in production,
   with an online test of two phones meeting live.

## 14. Decisions for the owner

1. **Visible number:** trophies over a hidden Glicko-2 (recommended), or Glicko-2 shown with "?"
   as ADR 0052 decided.
2. **By turns first, live when possible** (recommended), or wait for enough players for a live-only
   queue.
3. **League names and gates:** Bronze, Silver, Gold, Crystal, Champion, Legend every 400, or the
   game's own names.
4. **Season reset:** a quarter towards 1500 with RD ≥ 150 and trophies halved above Gold
   (recommended), or ADR 0052's halfway with RD 250.
5. **Ranked plays the season's ruleset** through frozen bundles (needs the client to show an older
   roster's lineup screen), or ranked-affecting balance waits for the season's end as decided.
6. **Everyone board opt-out:** shown by default with a setting to hide, or opt-in.
7. **One route without a session** (`/ranks/top`, CDN-cached), or the board inside `/me/ranks` at a
   function call per view.
8. **Pruning:** drop `rounds` and `picks` of finished ranked series after their season, keeping
   `final_setup` (which replays everything), or keep all until the database needs it.
9. **Pair cap:** 2 rated series per pair per day (1 on one network), or ADR 0052's one opponent
   per 24 h.
10. **When:** ranked after accounts and pokes are on in production, with a paid Netlify plan
    decided before live ranked at 200+ daily players.

## 15. Sources

- Clash Royale: Trophy Road and Path of Legends changes,
  https://supercell.com/en/games/clashroyale/blog/news/what-will-happen-to-your-trophies-2 ; the
  June 2025 update (10,000 road, seasonal arenas, partial reset, Ranked),
  https://supercell.com/en/games/clashroyale/blog/release-notes/june-update-2025/ ; trophy gates,
  https://supercell.com/en/games/clashroyale/blog/release-notes/new-update-feature-enter-the-trophy-road ;
  bots without rewards,
  https://support.clashroyale.com/hc/en-us/articles/49484905512219-Training-Camp-Practice-Mode
- Brawl Stars: monthly reset to 1,000,
  https://supercell.com/en/games/brawlstars/blog/news/trophy-season-rework-is-coming ; Ranked on
  Elo, https://supercell.com/en/games/brawlstars/blog/news/ranked-is-dead-and-ranked-is-back/ ;
  leagues, https://trophycoach.com/brawl-stars/guides/brawl-stars-ranks-explained
- Marvel Snap: cubes and retreat, https://blog.snap.untapped.gg/marvel-snap-wiki-snapping-retreating ;
  7 cubes a rank, https://primagames.com/tips/marvel-snap-patch-notes-may-16th-2023 ; floors,
  https://outof.games/marvel-snap/guides/257-how-to-rank-up-in-marvel-snap/ ; Infinite,
  https://toucharcade.com/2023/09/06/marvel-snap-infinite-rank-overhaul-conquest-mode-changes-balance-season/ ;
  matchmaking (fan analysis), https://marvelsnapzone.com/matchmaking/ ; bots,
  https://kotaku.com/marvel-snap-bots-rank-cheating-odin-hulk-easy-wins-1849710078
- Hearthstone: ranks, stars, floors, star bonus, https://hearthstone.wiki.gg/wiki/Ranked_play ;
  MMR and the bonus, https://support.blizzard.com/en/article/262336
- TFT: LP, placements, MMR reset,
  https://support.riotgames.com/en-us/tft/account/teamfight-tactics-ranked-faq ; LP and MMR,
  https://support.riotgames.com/league-of-legends/gameplay/mmr-rank-and-lp
- Super Auto Pets: Arena, https://superautopets.wiki.gg/wiki/The_Basics ; AI teams when no player
  team exists, https://en.wikipedia.org/wiki/Super_Auto_Pets
- Glicko-2: Glickman, http://www.glicko.net/glicko/glicko2.pdf ; Lichess's "?" above RD 110,
  https://lichess.org/faq (seen in search results; the page refused the fetch)
- Widening windows: https://developer.apple.com/documentation/gamekit/finding-players-with-similar-skill-levels ;
  https://learn.microsoft.com/en-ca/xbox/playfab/multiplayer/matchmaking/how-matchmaking-works ;
  low-population regions, https://www.microsoft.com/en-us/research/project/truematch/
- Not verified: Marvel Snap's current (2025) season reset formula; bots in Clash Royale and Brawl
  Stars ladder matchmaking (player reports only).

# Proposal: pick lineups together after accepting (2026-11-23, built: ADR 0080)

The owner's suggestion: a challenge (a friend's or a link) is sent without a lineup; once the
friend accepts, both pick their 3 (or 5) at the same time, each in secret, against a timer, then
the coin toss and the match. A rematch already works this way (ADR 0055: yes, then both lineups
within 60 s, then a new series).

**Recommendation: do it, as one machine for every live start.** A challenge becomes "an
agreement to play", and the lineup step that follows is the rematch's, generalised. Today's
sender builds a lineup before knowing if anyone will come, then waits; the friend builds theirs
while the sender stares at a lobby. Together, both are busy at the same moment, the wait is
shorter, and there is one flow to learn (challenge, rematch, later Ranked).

## The flow

- **Sender**: vs Friend setup (format, length) → Send challenge (no lineup) → the lobby, as now
  ("Waiting for Jo", the link, Share).
- **Friend**: the card or the link → the challenge card → **Accept** (no lineup yet).
- **Both, at once**: the lineup screen with a shared clock, **60 s** (the rematch's
  `REMATCH_LINEUP_MS`; 75 s for Best of 5). Each sees "Jo is choosing · 42 s", then "Jo is ready"
  once theirs is in, never which balls. Lock in early is allowed; the other's screen says so.
- **Both locked** → the series is made, seeds issued, the coin toss (ADR 0061), the match.
- **Time runs out**: whoever has locked gets their lineup; whoever hasn't loses the match by
  `start_missed` only if they never opened the lineup; otherwise their partial lineup is filled
  at random from the roster (as a pick running out does, ADR 0053) and the match starts. Both
  phones are told which ("Time ran out: Jo's lineup was finished at random"). This keeps a slow
  phone from stranding the other player, and every wait has an end.

## Fairness (ADR 0051, 0052)

Unchanged in substance: seeds are derived and stored only when the series is made, after both
lineups lock, and stay secret until each lock as today. Neither player sees the other's lineup
before the series starts (`viewOf`). The bot is not involved. A lineup is checked by
`checkLineup` on hand-in, as now.

## Server and data (expand only)

- A new table `game.starts` (or reuse `game.rematches` renamed in spirit): `id`, `challenge_id`
  or `old_series_id`, `agreed_at`, `lineup_a`, `lineup_b`, `new_series_id`, the deadline read
  against `now()`. One row per agreement; the rematch writes into the same table later.
- `game.challenges.lineup` becomes nullable (a migration that only relaxes `not null`); new
  challenges leave it empty. Old challenges in flight still carry one and start as today.
- Routes: `POST /challenges` without `lineup`; `POST /challenges/:token/accept` creates the start
  row (`in_a_match` checked here, not after a lineup); `GET/POST /starts/:id` (state and lineup),
  the rematch's GET/POST shape. The sweep and reads settle an expired start (random fill or
  `start_missed`), earliest first, like every live clock.

## Screens

- The send-lineup screen loses Send challenge; the lineup screen gains the shared clock and the
  other player's state ("choosing", "ready"), the same component as the rematch's lineup.
- The lobby no longer holds a lineup; Leave just cancels.
- The rematch's lineup and the challenge's become one module (`rematch-lineup.ts` → a start
  lineup), the floating card's "accepted, choose lineup" covers both.

## What can be deleted

The "build a lineup, then send" step and its copy; the challenge row's lineup on new challenges
(after a ruleset or two, the column can be dropped in a later migration once no live challenge
has one); the separate rematch lineup wait (merged).

## Tests

- `*.db.test.ts`: accept makes a start; both lineups start a series with seeds only then; a lineup
  after the deadline refused; expiry fills at random or forfeits by the rule above; one start per
  challenge (double Accept); `in_a_match` at Accept.
- Browser tests: the shared clock, "ready" without the balls, Back from the lineup holds the start.
- Online: two phones from a friend challenge and from a link: both pick at once, one slow (random
  fill), one never opens (`start_missed`), and a rematch through the same screens.

## Risks

- **Old clients mid-deploy** send challenges with lineups: keep accepting a lineup on
  `POST /challenges` for one release, and start such a challenge the old way.
- **Random fill feels unfair**; the alternative (forfeit on time) strands nobody but punishes a
  slow phone. Measure with the owner on phones before choosing.
- **A link to a stranger** (no account) now costs the sender a wait before choosing anything;
  the lobby stays, so it is no worse than today.
- **Showdown and Reveal** pick per round from the lineup, so nothing about rounds changes; Blind
  stays hidden from live.
- Two simultaneous timers on screen (the lineup's and the toss after) need the same server-time
  countdown (`countdownLine`) so both phones end together.

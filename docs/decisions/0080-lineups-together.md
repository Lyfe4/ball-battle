# 0080: Lineups picked together after accepting

- Status: Accepted (2026-11-23), approved by the owner as proposed in
  `docs/lineups-together-proposal.md`
- Date: 2026-11-23
- Amends: ADR 0053 (a live challenge carries no lineup; the start window follows the lineups), ADR
  0055 (the lobby holds no lineup; the rematch's lineup wait is this one), ADR 0079 PR (d) (a
  friend's challenge is accepted straight from its card)
- Keeps: ADR 0051 and 0052 (seeds are made only when the series is, after both lineups lock)

## Context

A live challenge was sent with the sender's lineup and accepted with the friend's: the sender built
three or five balls before knowing whether anyone would come, then stared at a lobby while the
friend built theirs. A rematch already worked the better way (yes, then both lineups within 60 s),
but on a separate screen and with its own rule for time running out (no match at all).

## Decision

**One machine for every live start: a start.** Accepting a live challenge (a link or a friend's
inbox card) or both saying yes to a rematch makes a row in `game.starts`; no series yet.

- **Both pick at once, each in secret,** on one clock: 60 s for a Best of 3, 75 s for a Best of 5
  (`startLineupMs`), from the agreement, written as `deadline_at` and read against `now()`.
- **Each phone sees** "Jo is choosing · 42 s" or "Jo is ready · 42 s", never which balls. A
  player's own draft is sent on every change of the tray (with a rising sequence: a late answer
  never replaces a newer draft) and is read back by its own player only, so a reload keeps it.
- **Both locked in**: the series is made at once (createSeries, so its seeds and commitments exist
  only from here, ADR 0051), the one who locked last marked as arrived.
- **The clock runs out**: a lineup still being built is finished at random from the balls it lacks,
  as a pick running out is (ADR 0053, `secureRandom`); a player who never opened the lineup before
  the deadline is filled too, so the series exists, and loses at once by `start_missed` (nobody
  wins when neither opened it). Opening is the player's own read of the start, before the
  deadline; accepting is not opening. Both phones are told which ("Time ran out: Jo's lineup was
  finished at random") on the way into the match.
- **Settled like every live clock**: on any read of the start (and the rematch's read), on a
  player's one-match check (a start out of time is made into its series before `in_a_match` is
  decided), on home's `/me/match`, and by the sweep. Never on a host's clock.
- **One live match at a time** counts a start from the Accept (or the rematch's yes): a player
  choosing a lineup can't send, accept or agree to another (`in_a_match`).
- **One screen**, `?start=<id>`, for a link, a friend's card and a rematch. Back holds the start;
  home's "Back to your lineup" (`/me/match` kind `start`) leads to it, the device's own latest tray
  kept (a reload reads the draft back from the server).

The vs Friend setup's button becomes Send challenge (no lineup step); the friend's card says
Accept (no lineup step). The lobby is unchanged ("Waiting for Jo", the link, Share, Cancel).

## Fairness

Neither player sees the other's lineup before the series starts (`viewOfStart` gives a player
their own draft and the other's locked flag only). The seeds don't exist while lineups are chosen:
the series and its secret seeds are made in the same transaction that takes the last lineup (or
settles the clock), exactly as the old Accept did. The random fill uses the platform's CSPRNG.

## Data (expand only)

- `game.starts`: the two players, format and length, `rematch_of` (unique), `agreed_at`,
  `deadline_at`, each side's `opened_*`, `draft_*` (text[]), `draft_seq_*`, `locked_*`, and the
  `series_id` it made. Only its own player reads a draft; once the series is made the row holds
  the same lineups as the series. The privacy policy's "Your matches" now names the lineup being
  built and when it was first opened.
- `game.challenges.lineup` drops `not null`; `game.challenges.start_id` names its start.
- `game.rematches.lineup_a`, `lineup_b` and `new_series_id` are no longer read or written for new
  rematches (`new_series_id` is still set when a start made from a rematch makes its series, so a
  page of the last release still finds the new match). Drop them, and challenges' `lineup` for live
  links, in a later migration once no page of the last release can be open.

## One release of the last release's pages

- A live challenge sent **with** a lineup is taken: its sender's side of the start is locked from
  it, so the friend picks on the new screen; the sender's old lobby polls the link and finds its
  `seriesId` once the series is made.
- A rematch lineup POSTed to `/series/:id/rematch` is locked into the rematch's start.
- An old page **accepting** a challenge sent without a lineup can't join a shared clock: it is told
  "This game has a new version: reload the page to accept" (409 `conflict`), and the build check
  (ADR 0066) offers the reload. An old page accepting an old challenge still starts the series at
  once, as before.
- A rematch agreed before this deploy (no start) reads as ended (time ran out): a 60-second window.

## Consequences

- `rematch-lineup.ts`, the send-lineup step (`?view=send&step=lineup`, `&rematch=`) and the
  challenge's own lineup step (`?challenge=…&step=lineup`) are gone; old URLs open the setup or
  the card.
- A slow phone never strands the other player; a phone that never shows up still loses, as before.
- Random fill may feel unfair to a slow picker; measure it with the owner on phones (the proposal's
  open risk) before tightening to a forfeit.

## Addendum (2026-11-23): the last release's paths removed

The release with lineups picked together has been published, so the one-release paths above are
gone; the next publish ships their removal.

- A live challenge sent or accepted **with** a lineup is refused (400 `bad_request`); a rematch
  lineup POSTed to `/series/:id/rematch` is refused like any body that isn't a yes or no. A page
  still cached from before is offered the reload by the build check (ADR 0066).
- A start no longer takes a side's lineup when it opens (`ready`), and a start made from a rematch
  no longer writes `game.rematches.new_series_id`: the rematch reads its new series from the start
  (`coalesce(st.series_id, r.new_series_id)` keeps old rows readable). A challenge's `series_id`
  is still written, as the link's own record of its match.
- Kept: a rematch agreed before lineups were picked together (no start) still reads as ended, since
  those rows stay in the database; and old lineup URLs still open the setup or the card.
- The columns no longer written (`challenges.lineup` for live links, `rematches.lineup_a`,
  `lineup_b`, `new_series_id`) stay: migrations are expand only (ADR 0068).
- Tests: `starts.db.test.ts` ("a lineup with a live link") and `rematch.db.test.ts` show both
  refusals; the live database tests now reach a series through the start (`playLink`).

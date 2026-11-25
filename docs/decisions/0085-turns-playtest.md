# 0085: Play by turns with a friend, on previews and staging, for the two-phone playtest

- Status: Accepted (2026-11-25); built (#185), checked on staging with two browser contexts;
  playtest checklist in `docs/turns-playtest.md`
- Date: 2026-11-25
- Builds on: ADR 0052 (play by turns: 24 h turns, forfeit on time), ADR 0053 (live is Reveal and
  Showdown; by turns hidden), ADR 0079 (friends, the inbox), ADR 0081 (the Play tab, the Friends
  tab, the one setup screen), ADR 0082 (pokes)
- Serves: ADR 0083, build plan step 4: "a real two-phone playtest of play by turns (24 h turns, the
  inbox, 'Your turn') before ranked builds on it"

## Context

Play by turns is built and tested on the server (a series with a 24 h turn clock, forfeit on time,
settled on read and by the sweep), but hidden: no page sends one, the accept that needs a lineup
was removed with ADR 0080, a challenge by turns to a friend is refused, the inbox has no turns and
a by-turns move pokes nobody. Ranked builds on it, so it needs a real playtest first, without
showing it in production.

## Decision

1. **Two switches, as accounts have** (ADR 0079): `VITE_TURNS` builds the choice
   (`TURNS_BUILD`, `netlify.toml`: deploy previews and the main branch deploy; production's command
   blanks it, so no dashboard value switches it on there; `check-bundle.ts` refuses "By turns" in a
   bundle built without it), and `BALLBATTLE_TURNS` lets the functions take a challenge by turns to
   a friend (set for the deploy-preview and branch-deploy contexts in the dashboard; local and the
   database tests set it). Off, the server refuses it as before ("A challenge to a friend is
   live"). A by-turns link to anyone was already accepted by the server and stays so.
2. **Started from the vs Friend setup, the one screen both entry points share** (ADR 0081): a
   friend row's Challenge and "Challenge with a link" open it. A "Play" row above Length offers
   Live and By turns (Live first and the default); by turns says what it asks and its button
   reads Choose lineup. The Play sheet stays live-only: Play goes straight in, and a lineup step
   from the sheet would be a second flow for the same thing. Least new UI: one segmented row.
3. **The lineup goes with the challenge** (as before ADR 0080, by turns only): the sender picks
   theirs after the setup, then Send challenge; the friend picks theirs after Accept, then Accept
   challenge goes straight into the series. The lineup is picked in place on the challenge screens
   (`turns-lineup.ts`), with no entry of its own: in-app Back returns to the setup or the card; a
   reload shows the setup or card again. Good enough for a playtest; an entry of its own waits
   for ranked's own flow.
4. **The inbox carries it** (ADR 0079 PR (d)): a challenge by turns to a friend waits in their
   inbox until accepted or expired (no lobby to wait in), never pops up as the floating card (it
   is not urgent; it waits in Friends' Waiting for you, Accept opening its lineup), and reads
   "take turns" where a live one reads "live". `turns` lists the series by turns where it is the
   account's turn, the soonest deadline first: Play's status strip says "Your turn vs Sam" (or "Your
   turn in 2 series"), the Friends badge counts it, and Waiting for you leads with "Your turn vs
   Sam · 22 h left" and Play.
5. **A turn that ran out is settled on the inbox's read** for that player's series
   (`settleExpired(…, player)`): the sweep runs only on production, where by turns is off, so on
   staging the clock would otherwise decide only when a series is opened.
6. **Pokes** (ADR 0082): every change a player reads of a series by turns bumps `version`, so a
   trigger on it (`20261125200000_poke_turns.sql`) pokes both players' `match` and `inbox`; a read
   pokes nobody (`poke.db.test.ts`). The series screen wants the socket while a series by turns is
   open, so the other's move shows the moment it lands; its 15 s read while waiting stays as the
   safety.

## Consequences

- Production is unchanged: no choice in its bundle, and its functions refuse a challenge by turns
  to a friend (accounts are off there too).
- Guests can send a by-turns link from the setup on staging; only accounts get the inbox and "Your
  turn" (friends are accounts only).
- The by-turns lineup has no URL of its own and no 16+ question of its own beyond the setup's.
  Ranked's flow (ADR 0083 PR 6) decides those properly.

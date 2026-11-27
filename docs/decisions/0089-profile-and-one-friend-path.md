# 0089: A Profile that stays short, and one vs Friend path

- Status: Accepted (2026-11-27), the owner's choice of A1 and B1 from the Profile and vs Friend
  mockups (kept locally); built in one stack (#238 to the top PR), 2026-11-27
- Date: 2026-11-27
- Amends: ADR 0088 (Profile's record: the card opens "Your stats", three matches then All matches;
  each match says how a forfeit ended), ADR 0081 addendum (Play against a friend, signed in, asks
  who before it sends a link)
- Builds on: ADR 0055 (the Play box), ADR 0080 (lineups together), ADR 0084 (one read per answer;
  its addendum of this date has All matches' cost), ADR 0085 (by turns), ADR 0086 (the sheet, the
  Friends tab's rows), ADR 0087 (the frame, loading states)

## Context

Profile listed every recent match (20) between who you are and your account, so Log out and Delete
account sat about 1,900 px down a phone. And there were two ways to play a friend: the Play box's
vs Friend sent a link to anyone, while challenging a friend by name lived on the Friends tab.
The mockups offered A1 (the record card opens a stats sheet, three matches, All matches as its own
screen) or A2 (stats folded into the card), and B1 (Play asks who in a sheet) or B2 (who inside
What to play). The owner chose A1 and B1 as recommended, approved the server changes Profile needs,
and set the forfeit words: "You left", "They left", "Your time ran out", "Their time ran out".

## Decision

### A1: Profile

1. **Order:** who you are; the record card (wins, played, favourite ball), a button that opens
   **"Your stats"** (the shared sheet, one ×): win rate, live and by turns, Best of 3 and Best of 5
   (won and lost each, "None yet" for none), best streak, most played ball and how often; then
   **Last matches**; then **Account** (Change username, Log out) and Delete account apart.
2. **Rows:** the opponent's disc, "Won" as a filled tag or "Lost" as an outlined one (a word, never
   colour alone), the score or the forfeit words, the date ("Today", "Yesterday", "24 Nov") and Live
   or By turns. A row opens the series' own screen, as before.
3. **Three on a phone, eight on a desktop.** The record already holds 20, so the desktop's main
   column shows up to eight, two side by side, at no cost; a phone shows three (CSS, one list).
   "All matches ›" shows only when there are more than the rows shown.
4. **All matches** is its own screen (`?view=matches`, Profile's browse kind, Back to Profile even
   from a cold link). Its first page is the record Profile read this visit (no second read; a cold
   link reads `/me/record`); later pages load as the list's end nears (an `IntersectionObserver`
   600 px ahead), with a sized loading row after 150 ms, "That's all 54." at the end, and the one
   failure card with Try again in the loading row's place, the rows kept. A guest's link goes to
   Profile.
5. **Desktop:** the matches fill the main column; who you are, the record, the account and the
   danger zone sit in the aside, so nothing important is below the fold. With no matches the
   record's empty card takes the main column (it is not drawn twice, as the mockup had it). The
   card spans the frame like every screen, so its header row stays on the tabs' pixels
   (`frame-account-flow.ts`).

### The server (no migration)

6. Each match carries `ending` from `game.series.end_reason`, said from the reader's side:
   `left`, `disconnected` or none (the deletion trigger forfeits to the survivor) is
   **You left / They left**; `timeout` (a turn by turns) and `start_missed` (a lineup never opened)
   is **Your time ran out / Their time ran out**; a forfeit both sides missed is the reader's own
   time. Null when played out.
7. `stats` is computed in the record's one statement from the same counted series: four tallies,
   the best streak (gaps and islands over `finished_at`) and the favourite ball's count.
8. **Paging:** the record carries `next`, a keyset cursor (`finished_at` to the microsecond and the
   id); `GET /api/v1/me/matches?after=` returns the next 20 and its own `next`. One statement and
   one counted read per page, from the record's own function (one cold start). A cursor names only
   a place in time, so another player's cursor reads only their own series from there.

### B1: one vs Friend path

9. **Signed in**, Play against a friend goes **straight to the friend last picked** while that can
   work (still a friend; online for a live match; by turns where the build plays by turns), else it
   opens **"Who do you want to play?"**: friends online first with Challenge (live, the box's
   rules), the rest with Play by turns (three, then "Show all N friends"), then "Anyone, with a link
   ›"; with no friends, sending a link is the main button and "Add a friend ›" goes to Friends. The
   rows are the Friends tab's (`personRow`), the whole row making its button's pick. Who is online
   is the inbox's list: the sheet makes no read of its own, and holds the rows' place until the
   inbox answers.
10. **The box remembers the pick** per device ("vs Robin · Live · Best of 3 · Reveal", their
    initial on the box's disc), stored with the account's username so another account on the device
    never sees it; Log out clears it with every `ballbattle.*` key. What to play adds "Choose who to
    play ›" under Against a friend, which opens the sheet.
11. **A challenge from the sheet goes straight to the friend's lobby** (no rules step: the box holds
    the rules), a step on from Play, as a link's lobby is. By turns opens its lineup, as from the
    friend sheet.
12. **The link's lobby offers "Or challenge a friend"**: up to three friends online with Challenge.
    There is one live lobby per player (`in_a_match`), so Challenge there **stops the link and sends
    the friend a challenge on its rules**, their lobby in the link's place; if the link was accepted
    meanwhile, that match opens instead. No friend online: nothing is added.
13. **A guest** goes straight to the link, as before, and its lobby says once "Sign in › to
    challenge friends in the game." **An online build without accounts** (production's shape) is
    unchanged: no sheet, no line, and none of this code in its bundle (`check-bundle.ts` now also
    marks `me/matches` as accounts code).

## Consequences

- Log out lands within one short scroll on a phone: at 390 x 664 with a long history it sits at
  698-746 px, the tab bar at 600 px, so about 150 px of scroll (Delete account at 795-843).
  Profile's page is 967 px; it was 2,040.
- Profile still costs one call per visit; All matches costs one per page a player scrolls to.
- The Friends tab's Challenge keeps its setup step (it chooses rules there); Play's sheet doesn't.
  The friend lobby's "Challenge someone else" still opens the vs Friend setup.
- Profile's rows say "By turns", which `check-bundle.ts`'s turns mark would flag in a build with
  accounts but without play by turns. No such build exists today; when accounts reach production
  (where turns stay off), that text needs `TURNS_BUILD` first.

## Addendum (2026-11-27): one vs Friend path, one challenge at a time, screens that agree

The owner's staging walk after B1 found that choosing someone in "Who do you want to play?" sent
the challenge at once (about a second frozen, nothing said); five ways in that disagreed (What to
play's "Choose who to play", the sheet, Play going straight to a remembered friend, the Friends
tab's Challenge with its own setup, the link lobby's "Or challenge a friend"); several challenges
to the same friend; one player left on "Back to your lobby" while the other had said no; and a
friend request that showed only after a few screen changes. The owner set the rules below. This
replaces decisions 9 to 12, and the Consequences' bullets on the Friends tab's setup step and the
lobby's "Challenge someone else".

### The one path

1. **What to play sets rules only**: Against (Bot / Friend), Length, Format and, against a friend,
   **How**: Live or By turns (By turns only where `TURNS_BUILD`). Never people. The box says
   "vs Friend · Live · Best of 3 · Reveal"; it never names a friend.
2. **Play against a friend, signed in, opens "Who do you want to play?"** on the box's rules (the
   rules line at its top): friends online first, the friend last picked first in each group, then
   "Send a link instead". **A tap only selects a row** (a chosen option, `choice.css`). One button
   at the bottom says what it sends: "Challenge Robin", "Play Jo by turns", "Send a link"; with
   nothing picked it says "Choose who to play" and does nothing. **Nothing is sent before that
   tap.** The button is busy on itself (`busyOnClick`) until the next screen can show; a failure is
   said above it in the game's words (`CHALLENGE_REFUSALS`), the pick kept, and the same request id
   is reused for the same pick (a retry after a lost answer gets the same challenge). Live needs
   the friend online; a friend not online is played by turns where the build has it ("Not online
   · by turns instead"), else listed but not pickable. Play never goes straight to anyone. With no
   friends the link is picked and "Add a friend ›" goes to Friends.
3. **A guest, or a build without accounts**: Play sends the link at once, as before (the 16+
   question first on a device without a guest).
4. **One waiting screen**, for a friend or a link: "Challenge sent", the waiting card ("Waiting for
   Robin" with their disc, or "Waiting for anyone with the link" with the bouncing ball), the
   rules, what comes next, "Leaving this screen cancels the challenge.", Cancel challenge. A link
   leads with Share and shows the link; a friend's folds it under "Also send a link". No other
   friends are offered on it (the link lobby's "Or challenge a friend" is gone); a guest's says
   once "Sign in › to challenge friends in the game."
5. **Every other way in enters the same sheet**: a friend's Challenge on the Friends tab (their
   row's inline Challenge and their sheet's one Challenge; "Play by turns" in the friend sheet is
   gone, the box's How decides) opens it with that friend picked; the Friends tab's link card with
   the link picked (a guest: the link at once); Ranks' "Play a friend now" and the cards'
   "Challenge a friend" / "Challenge someone else" open it (over Play, or over the card). The vs
   Friend setup screen is gone (`friend-setup.ts`); an old `?view=send` link lands on Play with its
   rules, and the sheet signed in, nothing sent. The send screen remains only as the place for the
   16+ question, a guest's failure, and the lineup by turns.
6. **The waiting screen lasts while it shows**: leaving it in the game (Back, a tab, another
   screen) cancels the challenge (`leaveWaiting`), and home asks `/me/match` only after that cancel
   has landed, so "Back to your lobby" never shows for it. A closed tab or a locked phone stops it
   when its heartbeat runs out (`LOBBY_SEEN_MS`, 60 s); "Back to your lobby" shows only for a
   lobby still alive on another tab or device, and home asks again at its `stopsInMs`.

### One outgoing challenge per player (server)

7. **Sending a challenge calls off the sender's older ones still waiting**, live or by turns, to a
   friend or a link, in the same transaction (`supersedeOutgoing`; `game.challenges.superseded_by`
   names the new one, migration `20261127120000_one_outgoing_challenge.sql`). Their `cancelled_at`
   pokes the old friend (`poke_challenge_changed`), whose banner or row goes at once. Both players'
   advisory locks are taken in one order, so two sends at once (a double tap on two phones) leave
   one. Still refused (`in_a_match`) while the sender is in a live match or picking lineups.
8. **Crossed**: a live challenge sent to a friend whose own lobby waits for the sender is an
   accept of theirs (their rules, made first): both go to the lineups (`ChallengeLink.startId`).
9. **Accepting a live challenge stops the acceptor's own lobby** (to anyone), poking its friend.
10. **A live No thanks ends the challenge** (`cancelled_at` with `invitee_declined_at`), and so
    does a block (read by the sender as a No thanks, as before). The sender's screen says "Robin
    said no thanks" with Challenge someone else and Home; nothing waits.
11. **The inbox's live invites and home's lobby carry `stopsInMs`**: how long, from that answer,
    until the lobby stops unless its page is heard from. A duration, never a time, so the phone's
    clock never matters. The recipient's page reads again then (the banner never outlives the
    lobby); home asks again then.

### The states, sender × recipient

Each row is what both screens show once it happens, how it reaches the other phone, and where it
is tested. "Poke" is the Realtime poke (ADR 0082), read within about a second; with the socket
blocked the same read comes on the page's own timer (the waiting screen every 2 s, the inbox every
2 s while a lobby waits or a rematch window is open, else 30 s).

| State                      | Sender sees                                                                  | Recipient sees                                                                               | How it gets there                                                               | Tests                                                                 |
| -------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| pending                    | Waiting for Robin (waiting card, rules, Cancel challenge)                    | The incoming banner on any screen but a fight (its row lit on Friends), Accept and No thanks | The insert pokes the recipient's inbox                                          | `one-challenge.db`, `friend-states.online`, `friend-challenge.online` |
| accepted                   | The lineups (`?start=`)                                                      | The lineups                                                                                  | `start_id` pokes the sender's waiting screen and the recipient's inbox          | `lineups-together.online`, `friend-challenge.online`                  |
| accepted on another device | The lineups                                                                  | That device's banner goes, with no "stopped waiting"                                         | The same poke; the sender reads as in a match                                   | `inbox-watch.browser`                                                 |
| declined                   | "Robin said no thanks": Challenge someone else, Home; no way back to a lobby | Banner gone                                                                                  | No thanks sets `invitee_declined_at` and `cancelled_at`, poking both            | `one-challenge.db`, `friend-states.online`                            |
| cancelled                  | Wherever they went; the old link reads "This challenge stopped"              | "Sam stopped waiting" with OK, or the row goes on Friends                                    | `cancelled_at` pokes the recipient                                              | `friend-states.online` (by leaving the waiting screen), `inbox.db`    |
| superseded                 | The new waiting screen; the old link reads "You sent a new challenge"        | Old recipient: "Sam stopped waiting"; the new one: its banner                                | `cancelled_at` with `superseded_by` pokes the old recipient; the insert the new | `one-challenge.db`, `friend-states.online`                            |
| stale                      | Back on the page: "This challenge stopped"                                   | The banner goes when the lobby stops                                                         | No poke (the clock decides): the recipient reads at `stopsInMs`                 | `one-challenge.db`, `inbox-poll.test`                                 |
| expired (by turns, 7 days) | Its card: "This challenge has expired"                                       | The row goes at the next read                                                                | The clock, then the next read                                                   | `turns-inbox.db`                                                      |
| blocked                    | "Robin said no thanks" (a block reads as a decline)                          | Banner gone; nothing new arrives                                                             | `callOffChallenges` sets declined and cancelled, poking both                    | `blocks.db`, `one-challenge.db`                                       |
| crossed                    | The lineups at once                                                          | The lineups at once                                                                          | The second send accepts the first: `start_id` pokes the first sender            | `one-challenge.db`, `crossed-challenges.db`, `friend-states.online`   |

### Why a friend request needed several screen changes

Two causes, both on the page; the server pokes every friendship write (`poke_friendship_*`).

1. **The inbox poll stopped keeping time when there was nothing to watch** (`inbox-poll.ts`: no
   next read after an answer with no friends, requests, invites or games). A new player, the one
   who gets a first friend request, read the inbox once at load and never again; a poke lost, or a
   socket down (blocked, a flaky network, Realtime's join racing the insert), left the request
   unseen until something restarted the poll: a sign-in, or Profile then a tab (`askWho` asks
   `/me` again and starts the poll). Now a signed-in page always keeps time: the safety read every
   120 s with the socket up, 30 s with it down.
2. **The Friends tab drew requests from `/friends` and never read it again on an inbox answer**: the
   inbox says only how many requests wait, so a new one showed in the badge but not in Waiting for
   you until Friends was opened again. Now Friends reads `/friends` again when the inbox's request
   count, or its set of friends, differs from what it drew (only while it shows; one call per
   change, never on a timer).

### Cost (ADR 0084)

- The inbox's safety read now runs for an account with nothing to watch too: at most one call per
  120 s while a page is visible with the socket up (30 s down), where there was none. An idle
  account's visible hour costs 30 calls with the socket up; a player with friends already paid it,
  inside the estimate of 140 calls a player-day.
- Friends reads `/friends` once more per request that arrives while it shows.
- A recipient reads its inbox once at each live invite's `stopsInMs` (about once a minute while a
  banner waits).
- Leaving the waiting screen is one cancel call, as Cancel challenge was.

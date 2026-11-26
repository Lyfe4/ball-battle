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

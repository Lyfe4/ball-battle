# Social UX: audit, flow walk and redesign (proposal)

> Copied from `proposals-social-ux/PROPOSAL.md` (2026-11-25), text only. Its screenshots, mockups,
> scripts and raw data are kept locally, untracked; references to them below say "kept locally".
> The decision record is ADR 0086.

- Status: proposal only (2026-11-25). No app code, branch or PR. Becomes ADR 0086 if approved.
- Amends (if approved): ADR 0081 (the strip, the badge, the pop-up; the Friends tab; the What to
  play sheet's two Dones), ADR 0070 (the floating card), ADR 0079 addendum of 2026-11-25 (a row's
  More), ADR 0085 (where by turns starts), ADR 0040/0044 (how menus close).
- Everything in this folder is throwaway and untracked: `shots/` (kept locally) (115 screenshots of the real game),
  `mockups/` (kept locally) (21 mockup screenshots), `mock/` (kept locally) (the mockup page: `pnpm dev`, then
  `/proposals-social-ux/mock/mock.html?s=play|play-invite|play-rematch|play-missed|friends|friend-sheet|block-confirm|report|request-sheet|blocked|what-to-play|lobby`),
  `walk/` (kept locally) (the Playwright scripts that took every screenshot, and `walk-log.md` (kept locally), what each phone
  showed at each step), `research.md` (kept locally) (Part B with sources).

## Where each screenshot came from

| Prefix                 | What                                                                                                | Where                                                                                                                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `A*`, `D*`, `E*`, `T*` | Signed-in accounts, two Chromium contexts at 390 × 664                                              | **Local stack**: `pnpm build:online` (accounts, turns, poke on), `netlify dev --offline` on :8888, local Supabase, codes from Mailpit. I can't receive email codes for staging accounts, as the brief foresaw. |
| `S*`                   | Guests and by-link flows (first-time guest, 16+, own link, used link, cancelled link, desktop link) | **Staging** (https://main--battle-ball.netlify.app). Every live match ended with Leave, so staging (which never sweeps) holds nothing open.                                                                    |
| `F*`                   | Focus rings after taps                                                                              | Local online build, WebKit with touch (iPhone Safari's engine) and Chromium                                                                                                                                    |
| `N*`                   | Accounts off (production's shape)                                                                   | A client build with `VITE_ONLINE` only, `vite preview`                                                                                                                                                         |
| `M*`                   | Mockups                                                                                             | `pnpm dev`, the game's own `src/style.css`, tab bar and ball renderer                                                                                                                                          |

No switch was touched (friend-switch, poke-switch, Netlify env, Supabase dashboard). Production was
not opened. The only database writes outside the app's own API were on the **local** database: the
flow kit's usual reset of the code counters, and one by-turns deadline moved into the past (T09).

---

## Part A: what's wrong today

### The five named problems, confirmed

**1. A friend's More is a debug panel.** (`A02`, `A03`, `A04`) Tapping "More ›" adds a second line of
three pink text links ("Close ›", "Report name ›", "Block ›") under a row that already has
"Remove ›" and "More ›" beside a Challenge button. Block's question then puts "Keep ›" (a link) beside
"Block" (a button), with Keep first. Every one of these is `text-link friends-action`:

```ts
// src/ui/online/friends-more.ts
function textButton(text: string, label: string): HTMLButtonElement {
  const button = element('button', 'text-link friends-action', text);
```

So the row offers six things at one level, five of them links with a "›" that says "goes
somewhere" when they don't, and the dangerous ones (Remove, Block) look exactly like Copy and Close.
The same More hangs off a friend request and off a friend's challenge (`A07`, `T04`).

**2. The same news three times on Play.** (`A06`) One challenge = the strip ("1 challenge waiting
›"), the floating card (Accept · No thanks · Later) **and** the Friends badge. Worse:

- The strip's green "online" dot sits in front of "1 challenge waiting" (`A06`, `A09`).
- The strip costs the demo court most of its room: at 390 × 664 the court is **about 60 px**
  with the strip (`A06`, `D10`) and about 200 px without it (`F01`). It reads as a thumbnail left
  behind.
- On the Friends tab the card floats over the very row it duplicates, covering "Your friend code"
  (`A07`): the same challenge twice on one screen.
- The card covers page content: "Free play" and "Privacy · Terms" sit under it (`D10`, `D12`),
  though `update-notice.css` says the page "gains room under its end while it shows". The Play tab
  doesn't scroll, so that room never helps.

The code makes it explicit: one answer drawn in three places.

```ts
// src/screens/inbox-views.ts
shell.waiting(inbox === undefined ? 0 : waitingCount(inbox));
home.setStatus(inbox === undefined ? undefined : statusLine(inbox));
```

**3. Focus rings on tap.** Reproduced in WebKit with touch (`F02`): opening What to play by a tap
rings "vs Bot" with the focus halo _outside_ the chosen ring (pink choice outline + pink focus
shadow = two rings). Chromium doesn't (its `:focus-visible` heuristic ignores script focus after a
pointer). Cause, from the code:

```ts
// src/ui/play-sheet.ts (open)
dialog.querySelector<HTMLElement>('[role="group"]:not([hidden]) [aria-pressed="true"]')?.focus();
```

WebKit matches `:focus-visible` on script focus when nothing had keyboard focus before, and iOS
Safari never focuses a tapped button, so after a tap it is always "nothing before". The Play
button's ring has a one-off patch that only lasts until Play first loses focus:

```ts
// src/ui/home.ts
const quiet = () => {
  delete play.dataset['quietFocus'];
};
document.addEventListener('keydown', quiet, { capture: true });
play.addEventListener('blur', quiet); // gone for good after the first blur
```

So after any tap away from Play and back to the tab (`screens/home.ts:136` focuses Play on
arrival) the ring is back on an iPhone. I could not make headless WebKit on Windows show this second
case (`F07`: no ring); it is **from the code** plus the owner's sighting, not seen here.

Every place that moves focus by script after a tap, and so can ring on an iPhone (from
`grep "\.focus()"`; headings with `tabindex=-1` never ring and are left out):

| Where                                           | Focuses                                          | Rings after a tap?                                                            |
| ----------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------- |
| `src/ui/play-sheet.ts:172`                      | the chosen option on open                        | yes (seen, `F02`)                                                             |
| `src/ui/home.ts:231`, `src/screens/home.ts:136` | Play on arrival                                  | yes once `data-quiet-focus` is gone (code)                                    |
| `src/ui/settings-menu.ts:302`                   | the gear on close                                | yes after Close/tap-outside (code); Escape is a key, so correct there (`F06`) |
| `src/ui/symbol-legend.ts:63,71`                 | the `?` on close                                 | yes (code)                                                                    |
| `src/ui/series/level-choice.ts:49,67`           | its toggle                                       | yes (code)                                                                    |
| `src/ui/series/lineup-step.ts:104,117`          | a tile, then the Done button when the tray fills | yes: Lock in rings as the tray fills (code)                                   |
| `src/arena.ts:388`                              | the ready card's Fight!                          | yes (code)                                                                    |
| `src/ui/manual/matchup-spectrum.ts:97,221,225`  | the change button, a chip                        | yes (code)                                                                    |
| `src/ui/online/friends-section.ts:215`          | More, after Keep/Close                           | yes (code)                                                                    |
| `src/ui/online/friends-section.ts:280`          | the Add field on an empty Add                    | a field is fine to ring (it takes typing)                                     |
| `src/ui/online/forget-me.ts:50,55`              | No / the start button                            | yes (code)                                                                    |
| `src/ui/quick-setup.ts:172`                     | Start                                            | yes (code)                                                                    |
| `src/ui/notice.ts:207`                          | a notice's field                                 | fine (a field)                                                                |
| `src/ui/balls/ball-grid.ts:109`                 | a tile on arrow keys                             | keyboard only, correct                                                        |

**4. Two Dones on What to play** (`F02`, `N03`): "Done ›" (a link with a chevron) top right, a
full-width Done at the bottom, and tap-outside, Escape and Back. The top one is hidden from screen
readers, so sighted and screen-reader users meet different sheets.

**5. By turns is hidden.** Its only door is the vs Friend setup's "Play" row (`D02c`), reached from
a friend row's Challenge or "Challenge with a link". The Play sheet doesn't offer it (ADR 0085 chose
that), and nothing on the friend row says it exists. Judgement: it belongs **on the friend**, not on
Play. A by-turns game needs both players to have accounts to be told "Your turn" (a guest's link
works, but they'd never hear of their turn), so it is a friend-to-friend thing; it starts from the
friend sheet's "Take turns" (Part C). The vs Friend setup keeps its row for a link.

### Everything else that feels unintentional

Ordered roughly by how often a player meets it.

| #   | Where                      | What                                                                                                                                                                                                                 | Shot                       |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| 6   | Friends list               | A friend who is sitting in a lobby waiting **for you** shows "In a match" with a Challenge button beside it; the same row in Waiting for you says they challenge you.                                                | `A07`                      |
| 7   | Friends rows               | `.friends-status::before` draws a status dot in front of every second line, so "Best of 3 · Reveal" on a challenge gets a grey dot.                                                                                  | `A07`, `T04`               |
| 8   | Waiting for you            | A by-turns challenge row reads exactly like a live one ("Best of 3 · Reveal"); only the floating card (which by turns never shows) says "take turns".                                                                | `T04`                      |
| 9   | Links for actions          | "Remove ›", "More ›", "No thanks ›", "Decline ›", "Copy ›", "Cancel challenge", "Leave match ›", settings' and the legend's "Close ›", the sheet's "Done ›": actions drawn as links, most with a "go there" chevron. | `A01`, `D03`, `E10`, `F02` |
| 10  | Lobby to a friend          | Leads with Copy link (yellow, primary) and the raw URL when the friend already has it in the game; the waiting state is a ball on a card with no motion; Cancel is a pink link at the end.                           | `D03b`                     |
| 11  | Rematch vs challenge cards | "One look" (ADR 0070) but two looks: the rematch has a clock title and a bar; the challenge is a sentence and three equal buttons with no clock, then vanishes after 20 s.                                           | `A06`, `D10`               |
| 12  | After a rematch ran out    | The asker reads "No rematch: time ran out." on the end screen, then gets the same news again as a floating card with OK on Home.                                                                                     | `D11`, `D12`               |
| 13  | Sending twice              | Back from your lobby, send again: "You're in a match already · Your lobby is waiting: finish it first". It isn't a match and you can't "finish" a lobby; the words come straight from the server's 409.              | `E05`                      |
| 14  | Leave match                | A grey text link mid-screen; its question has Stay (yellow) and Leave (plain), fine, but the leaver lands on Home with nothing saying they lost.                                                                     | `E12`                      |
| 15  | Play box                   | Its "›" renders as a clipped round glyph at the box's right edge.                                                                                                                                                    | `A06`, `F01`               |
| 16  | Demo line                  | "Demo match: Spartan vs Vampire" in a pill box of its own, the same weight as real controls.                                                                                                                         | `F01`                      |
| 17  | Friend code                | Labelled twice: the card's title "Your friend code" and the row's "Your friend code".                                                                                                                                | `A01`                      |
| 18  | Sent / Blocked             | Live inside the "Your friend code" card; Blocked has no explanation of what blocking did.                                                                                                                            | `E14`                      |
| 19  | Errors                     | The server's 409 sentence is shown as the page title (`E05`); a 409 on a second Accept is a console error (walk log).                                                                                                | `E05`                      |

---

## Part B: what the big games do (summary; sources in `research.md` (kept locally))

Official help centres refused automated reads, so several points rest on search excerpts of
official pages, and fine UI detail (red styling, dialog wording) is **unverified** for all 12.

- **Social lives in its own place** (~10 of 12). No game I could source shows social news inside the
  Play surface. The strongest "home" case (Squad Busters) is a Friends _button_ beside Play.
- **Friends online is a count or light on the Friends entry or per row** (Clash Royale's green count
  on the Social tab, Hearthstone's count on the friends icon, Clash of Clans' light per row, Runeterra's
  Online/Offline sections).
- **Challenge only when it can succeed**: Hearthstone shows the crossed swords only for a friend
  online and not in a match.
- **The sender can cancel a pending challenge** (Runeterra). **Invites expire** (Brawl Stars). A
  global "do not disturb" exists (Brawl Stars).
- **Requests wait in a list** (Pokémon TCG Pocket's Approve, Runeterra's Pending); live challenges
  are transient prompts.
- **Remove / Block / Report are always one level deep** (a tap on the friend, a menu, an edit
  mode), never loose on the row. Clash Royale confirms Remove with OK. Block is distinct from Remove
  and also unfriends (Riot) or needs unfriending first (Hearthstone). Report sits where the offence
  is (a chat line, a recent opponent, a profile name).
- **One close per sheet**: no source shows two visible closes; Marvel Snap shipped a fix for a
  missing chat close.
- Turn-based "your turn" placement: not documented for the one async game in the list (Super Auto
  Pets); unknown.

---

## Part C: the redesign

### Where each social signal belongs

The owner's instinct holds, and the research backs it:

| Signal                                        | Today                       | Proposed                                                                                        |
| --------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------- |
| A challenge, a request, a turn waiting on you | strip + badge + card        | **Badge on Friends** (count of what waits on _you_) + **Waiting for you** at the top of Friends |
| A live challenge arriving now                 | floating card (bottom)      | **One incoming banner** (top on a phone, bottom right on a desktop)                             |
| Friends online                                | strip on Play + row status  | **Friends tab only**: "2 online" beside the list's title, a dot per row                         |
| "Your turn" (by turns)                        | strip on Play + badge + row | Badge + Waiting for you row with Play (and the banner? no: not urgent, ADR 0085 kept)           |
| Play tab                                      | demo, strip, box, Play      | demo court at full size, box, Play. Nothing social.                                             |

One argument against, considered: the strip was there so a player on Play _sees_ a friend is
online and thinks "let's play". The badge doesn't say that. But a count of online friends flickers on
a 150 s window (`ONLINE_MS`), and Battle.net's friend-activity toasts drew complaints; the games
that show "online" do it on the Friends entry. If the owner wants that nudge kept, the place is a
small green dot on the Friends tab icon (no number), not a strip that eats the court. **Decision for
the owner** (below).

### Tap a friend: the friend sheet (`M05`, `M06`, `M07`, `M08`)

- **Rows** (`M05`): avatar disc, name, status with its dot, and **one** inline action: Challenge,
  only when they're online and not in a match (Hearthstone's rule). The whole row is a button with
  a "›" that opens the friend sheet. No Remove, no More on the row.
- **The friend sheet** (`M06`) reuses the What to play frame (`play-sheet.css`: bottom sheet on a
  phone, a panel in the middle beside and on a desktop; native modal `<dialog>`): a large avatar
  ringed in their status colour, name, @username, status; **Challenge · live** (primary, its rules
  on a second line), **Take turns** (secondary, where `TURNS_BUILD`), then Remove friend as a row;
  then, under a rule, **Report name** and **Block** in the danger style (red words on a red-tinted
  row, `--color-unfavoured` on `--color-band-edged`, which already exist). One close: the × top right.
  The record line ("You 3 – 2 Jo") is drawn but needs data the server doesn't serve yet: drop it or
  make it a later PR (decision below).
- **Confirmation** (`M07`): Block and Remove swap the sheet's content for a confirm step: a title
  ("Block Jo?"), what it does as short lines ("removed from your friends", "can't add or challenge
  you", "isn't told; unblock in Friends › Blocked"), the red **Block Jo** button, and Cancel. Back,
  Escape and × are Cancel. Remove is the same with one line ("You can add them again later").
- **Report** (`M08`): the reasons as the shared choice rows, an "Also block Jo" box, Send report in
  red. Then the sheet closes and a line says thanks (as today's `REPORTED_LINE`).
- **The same sheet for a request** (`M09`: Accept, Decline, then Report and Block) and for
  **Blocked** (`M10`: a sheet listing who's blocked with Unblock buttons and one line on what
  blocking means). Sent requests get the same list sheet with Cancel request.
- **Waiting for you** (`M05`): each row's actions are real buttons side by side under the name
  (secondary No thanks / Decline, primary Accept / Play). A challenge row says "live" or "take
  turns". Report and Block move into the person's sheet (tap the row).

### The incoming challenge: one component (`M02`, `M03`, `M04`)

- **One banner** for a friend's live challenge and a rematch (the rematch card folds into it):
  avatar, "Alex challenges you" / "Alex wants a rematch", the rules, No thanks and Accept, a × that
  means Later, and a thin bar at its foot that drains for the time it will wait.
- **Enters** from the top on a phone (it covers the header row, never Play, the court or the tab
  bar), from the bottom right on a desktop and beside; it slides in (a fade with reduced motion).
  Sound: today's `tap` for the arrival is enough.
- **Leaves**: Accept (to the lineup), No thanks (the sender is told), × or 20 s unanswered: it
  **slides into the Friends tab's badge** (the badge pulses once), so the player learns where it
  went. It never comes back as a banner on this page, as today.
- **While the player is on Friends**, no banner: the row in Waiting for you lights up instead (no
  double).
- **When the sender stops waiting** (cancelled, or their lobby went stale after 60 s): an open
  banner turns into "Alex stopped waiting · Challenge them back from Friends" with OK (`M04`), and
  the row leaves Waiting for you. Today it just disappears (`E02`, `E07`).
- **A rematch's clock is the server's** (30 s, as today), so its bar is honest. A challenge has no
  server clock to show (it waits as long as the lobby does); its bar is the banner's own 20 s, and
  the words say where it goes ("Later: keep it in Friends" is the ×'s name).
- **Never over a fight or a lineup** (`invitesMayShow`, unchanged; `E06` shows it holding and
  showing after).
- **News already shown isn't shown again**: an ending the player read on the end screen doesn't pop
  up on Home (`D12`).

### Play tab (`M01`)

The strip goes; the court gets its 140 px back; the box and Play as today. "Free play" stays a link
(it navigates). Nothing else changes.

### What to play (`M11`)

One close, the × top right in the head, as every sheet. No Done at all: choices apply as they're
tapped, so "Done" promised a commit that doesn't exist. Tap outside, Escape, Back close it too.
Focus goes to the sheet's title on open (below), not the first option.

### The friend lobby (`M12`)

"Challenge sent" as the title; a card with Jo's avatar, "Waiting for Jo", the rules and a gentle
pulse; one line on what happens next ("you both pick lineups, 60 s"); **Cancel challenge** as a
plain button; the link folded under "Also send a link". The link-only lobby (no friend named) keeps
Copy link first, as today.

### Focus rings: keyboard only, app-wide

- **One input-modality flag**: `pointerdown` (capture) sets `<html data-input="pointer">`, `keydown`
  sets `data-input="key"`. `base.css`'s ring rule and every component `:focus-visible` rule gain
  `:root:not([data-input='pointer'])`. This is the fix iOS Safari needs (its `:focus-visible` matches
  script focus after a tap), and it replaces `data-quiet-focus`. A test reads every stylesheet and
  fails on a `:focus-visible` ring rule without the guard (in the style of `press.test.ts`).
- **A sheet focuses its title** (`tabindex="-1"`, which already never rings): screen readers hear
  the dialog's name, then Tab reaches the first option. Same for the friend sheet and confirms.
- Keep script focus on close (gear, `?`, the box): it's right for the keyboard, and the flag hides
  it after a tap.

### The UI quality bar (for CLAUDE.md, under **UI**)

- New UI gets a mockup in the game's real styles first (a throwaway page under `pnpm dev`), at
  390 × 664 and one beside or desktop view, before code.
- An action is a button or a sheet row; a text link only navigates (it keeps its "›"). No chevron
  on Close, Cancel, Copy, Remove.
- One place per piece of information on a screen; the same news never shows twice at once.
- No doubled controls: one close per overlay (the × in its head; tap outside, Escape and Back as
  well), one primary per card.
- Destructive actions (Remove, Block, Leave, Delete, Forget me) sit apart from the rest, in the
  danger style, one level deep, and are confirmed with what they do; Cancel is the safe default.
- Focus rings only for the keyboard (the `data-input` guard); a sheet focuses its title.
- Every state is designed: empty, loading (skeleton), error (Try again), offline, and the
  other person gone; a server refusal is said in the game's words, never its error text.
- A per-person action opens that person's sheet; a row offers at most one inline action, and only
  when it can succeed.

---

## Part D: the whole challenge flow, walked

Live, signed in (local stack, two accounts, friends). Each step: what A (Sam, the sender) and B
(Jo) saw. Shots and the words each phone showed are in `walk/walk-log.md` (kept locally).

| Step                     | A sees                                                                                              | B sees                                                                                                      | Problem                                                         | Fix                                                                                                      | Sev   |
| ------------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----- |
| Before                   | Friends: Jo · Online, Challenge, Remove ›, More › (`A01`)                                           | Play: strip "1 friend online", box, Play (`D01`)                                                            | Strip costs the court; row crowded                              | Part C rows; no strip                                                                                    | M     |
| Send                     | Challenge → vs Friend setup: Play (Live / By turns), Length, Format, Send challenge (`D02`, `D02c`) | —                                                                                                           | By turns hidden here; a setup screen for one tap                | Friend sheet: Challenge · live goes straight to the lobby on the last rules; Take turns opens its lineup | M     |
| Waiting                  | "Your challenge · Waiting for Jo", Copy link (primary), URL, a paragraph, Cancel link (`D03`)       | card ~1 s later (poke): sentence + Accept · No thanks · Later; strip "1 challenge waiting"; badge 1 (`A06`) | Same news ×3; card covers Free play; lobby leads with Copy link | One banner; lobby redesign                                                                               | **H** |
| B looks in Friends       | —                                                                                                   | the card floats over its own row in Waiting for you (`A07`); Sam shows "In a match" with Challenge          | Duplicate; wrong status                                         | No banner on Friends; "Waiting for you" status for a lobby sender                                        | M     |
| Later                    | —                                                                                                   | card gone, badge stays, strip stays (`A08`, `A09`)                                                          | fine (folded)                                                   | the banner flies into the badge                                                                          | L     |
| Accept                   | lobby moves to "Your lineup" by itself                                                              | Accept (from Friends) → "Your lineup · Sam is choosing · 59 s" (`D04`)                                      | good                                                            | —                                                                                                        | —     |
| Lineups → match          | toss, picks, fights (`D05`, `D06`)                                                                  | same                                                                                                        | good                                                            | —                                                                                                        | —     |
| End                      | "You win 2–0", Rematch, Home (`D08`)                                                                | "You lose"                                                                                                  | good                                                            | —                                                                                                        | —     |
| Rematch asked, B on Home | "Rematch asked" on the end screen (`D10`)                                                           | rematch card with clock and bar over Home, covering Free play (`D10`)                                       | a second card look                                              | one banner                                                                                               | M     |
| Ignored 30 s             | "No rematch: time ran out." (`D11`)                                                                 | card goes silently                                                                                          | B never told it lapsed (fine: they ignored it)                  | —                                                                                                        | L     |
| Home                     | the same ending again as a floating card with OK (`D12`)                                            | —                                                                                                           | repeat news                                                     | don't repeat what the end screen said                                                                    | M     |

By link, guests on staging:

| Step                 | Sender                                      | Friend                                                                                                                  | Problem                                                                 | Fix | Sev |
| -------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --- | --- |
| First online act     | 16+ question, then the lobby (`S03`, `S04`) | —                                                                                                                       | fine                                                                    | —   | —   |
| Opens the link       | —                                           | "A challenge from Player 8932", rules chips, How it goes, Accept, Not now (`S06`); desktop the same in a column (`S07`) | good; "Not now" is a link to Home (fine: it navigates)                  | —   | —   |
| Accepts (first time) | —                                           | 16+ question after Accept (`S08`), then lineup                                                                          | the 16+ step after Accept reads as a second gate; acceptable (ADR 0055) | —   | L   |
| Lineups              | both pick (`S09`)                           |                                                                                                                         | good                                                                    | —   | —   |

Edge cases (local stack unless said):

| Case                                    | What happens today                                                                                                                                                                                        | Problem                                                                      | Proposed                                                                                                        | Sev   | Seen?                                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------- |
| Invitee offline when sent, back online  | nothing while offline; card 0.8 s after back online (`E09`)                                                                                                                                               | no offline hint on Play                                                      | the app-wide "You're offline" line (exists for requests) on tab screens too                                     | L     | seen                                           |
| Invitee's app closed, opens later       | card on opening, while the sender still waits (`E08`)                                                                                                                                                     | good                                                                         | —                                                                                                               | —     | seen                                           |
| Tab hidden / phone locked               | the poll never reads while hidden; the socket sends a poke; on show, the inbox reads                                                                                                                      | the 20 s fold timer can run while the page shows but the phone is down; fine | start the fold timer on `visibilitychange` visible                                                              | L     | code                                           |
| Invitee in a bot lineup                 | held; shows on Back to Home (`E06`)                                                                                                                                                                       | good                                                                         | —                                                                                                               | —     | seen                                           |
| Invitee in another live match           | `invitesMayShow` false; and A's Challenge stays on a friend "In a match"                                                                                                                                  | sender sends into a wall                                                     | hide inline Challenge for "In a match"; the sheet says "Jo is in a match"                                       | M     | code + `A07`                                   |
| Both challenge each other               | two lobbies; A sees B's card over A's lobby (`E04`); Accept is refused: "Your lobby is waiting: finish it first" (server, `checkNotLive`)                                                                 | deadlock in words                                                            | accepting the challenge from the person your lobby waits for cancels your lobby first (server, one transaction) | **H** | seen + code                                    |
| Challenge sent twice                    | Back from the lobby, Send again → "You're in a match already" page (`E05`)                                                                                                                                | wrong words, a dead-end feel                                                 | "You already challenged Jo" with Open it / Cancel and send this                                                 | **H** | seen                                           |
| Two tabs, accept on one                 | the other tab's card goes by poke (`E03`)                                                                                                                                                                 | good                                                                         | —                                                                                                               | —     | seen                                           |
| Sender cancels                          | sender to Home; B's card goes at once (`E02`)                                                                                                                                                             | silent                                                                       | "Alex stopped waiting" for 4 s                                                                                  | M     | seen                                           |
| Sender closes the app                   | B still sees the card; ~60 s later it's gone from Friends with no word (`E07`)                                                                                                                            | silent; Accept in between may fail                                           | the same "stopped waiting"; the server's `LOBBY_SEEN_MS` already decides                                        | M     | seen                                           |
| Expired                                 | live: as above (a lobby lives while watched); a link lasts 7 days                                                                                                                                         | —                                                                            | —                                                                                                               | —     | code                                           |
| Declined                                | sender's lobby: "Jo said no thanks" and the link stays (`E01`)                                                                                                                                            | fine; but the primary is still Copy link                                     | lead with "Challenge someone else" / Home                                                                       | L     | seen                                           |
| Link opened by its sender               | their own lobby (`S05`)                                                                                                                                                                                   | good                                                                         | —                                                                                                               | —     | seen                                           |
| Link opened after use                   | "Challenge taken" (`S10`)                                                                                                                                                                                 | good                                                                         | —                                                                                                               | —     | seen                                           |
| Link opened after cancel                | "Player 8932 stopped waiting" (`S13`)                                                                                                                                                                     | good                                                                         | —                                                                                                               | —     | seen                                           |
| Desktop vs phone                        | same card in a column (`S07`)                                                                                                                                                                             | good                                                                         | —                                                                                                               | —     | seen                                           |
| Never opens the lineup / clock runs out | 60 s, then the series made; the late side's lineup random (`E10`); the "finished at random" line wasn't caught in my shots                                                                                | —                                                                            | —                                                                                                               | —     | partly                                         |
| Leaves mid-fight                        | Leave match › → "Leave and forfeit? Stay / Leave" (`E12`); the leaver lands on Home with no word; the other "left the match. You win."                                                                    | leaver not told                                                              | "You left: Jo wins" line on Home once                                                                           | M     | seen                                           |
| Loses connection                        | other: away, then after 30 s "disconnected. You win."; the late one, back: "You were away too long and lost." (`E11`)                                                                                     | good                                                                         | —                                                                                                               | —     | seen                                           |
| Rematch ignored                         | above (`D11`, `D12`)                                                                                                                                                                                      | repeat on Home                                                               | —                                                                                                               | M     | seen                                           |
| Rematch from both at once               | the second yes agrees (server locks the row: `rematch.ts:118`)                                                                                                                                            | —                                                                            | —                                                                                                               | —     | code (my scene's forfeit sent the leaver home) |
| Blocked player challenges               | the blocker vanishes from the blocked's list; the blocked can "Add" again and it says "Request sent" (silent, by design) (`E14`); the blocker **can accept the blocked player's link** and start a lineup | a link bypasses a block without a word                                       | the link card says "You blocked Sam" with Unblock or Not now                                                    | M     | seen                                           |
| Accounts off (production)               | Friends tab: link card + "Friends lists are on the way" (`N02`); sheet has vs Friend (`N03`)                                                                                                              | fine                                                                         | —                                                                                                               | —     | seen (client)                                  |

By turns (local):

| Step / case                 | What happens                                                                                                       | Problem                                           | Proposed                                                              | Sev   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- | --------------------------------------------------------------------- | ----- |
| Send                        | setup → By turns → Choose lineup → Send → "Sent to Jo" + Home + Share (`T01`, `T02`)                               | fine                                              | start from the friend sheet                                           | M     |
| Arrives                     | no card (by design); strip "1 challenge · 1 online"; badge (`T03`)                                                 | the strip is Play's only sign                     | badge + Waiting for you                                               | M     |
| In Waiting for you          | row identical to a live one (`T04`)                                                                                | doesn't say take turns                            | "Take turns · Best of 3 · Reveal"                                     | M     |
| Accept                      | lineup → Accept challenge → series "Waiting for Sam · 23 h left" with Home (`T05`, `T06`)                          | fine                                              | —                                                                     | —     |
| Your turn                   | A's Play strip "Your turn vs Jo · 1 online"; badge; row with Play (`T07`, `T08`)                                   | fine, minus the strip                             | badge + row                                                           | L     |
| A game waiting on the other | **appears nowhere** once you leave it (B, `T07`)                                                                   | a game you're in is unreachable except by its URL | "Your games" list in Friends (each with whose turn and time left)     | **H** |
| A turn runs out             | settled on the inbox read; both Plays show nothing (`T09`); the series is simply gone from Waiting for you (`T10`) | the winner and loser are never told               | an "ended" row ("You won vs Sam: their turn ran out") kept until seen | **H** |

---

## Part E: the plan, small ordered PRs

Each PR ships alone, keeps the game whole, greps `*.online.test.ts` before renaming any words, and
shows the screenshots named (390 × 664 and 1280 × 800).

1. **ADR 0086 and the quality bar** (docs). The record of this proposal as approved, ADR 0081's
   amendments listed, the quality bar in CLAUDE.md's UI section. No code.
2. **Focus for the keyboard only.** `src/app/input-modality.ts` (the `data-input` flag), every
   `:focus-visible` ring guarded, `data-quiet-focus` removed, sheets focus their title. Tests: a
   stylesheet scan for unguarded rings; `play-box.safari.browser.test.ts` taps the box and finds no
   `:focus-visible`-styled element (box-shadow none) in the `iphone` and `touch` projects, and Tab
   still rings. Shots: the sheet after a tap, after Tab. Amends ADR 0081 (the Play addendum's
   "No ring round Play").
3. **One close per overlay.** A shared × (`src/ui/close-button.ts`) in What to play's head;
   both Dones removed; settings' and the legend's "Close ›" become the same ×. Tests:
   `look-checks.ts` (every open dialog or panel has exactly one visible close), `play-box` (×,
   Escape, tap outside, Back), `settings-one-look`. Shots: the sheet, settings, legend. Amends ADR
   0040/0044, 0081.
4. **The sheet as a component.** `src/ui/sheet.ts` out of `play-sheet.ts` (dialog, head with title
   and ×, focus, Back closes, confirm step), What to play rebuilt on it, no visual change. Tests:
   `play-box`, a unit test of the confirm step's focus and Escape. `one-of-each.test.ts` learns the
   sheet.
5. **Friend rows and the friend sheet.** Rows (avatar, status, one inline Challenge when it can
   succeed, the row opens the sheet), the friend, request, sent and blocked sheets, the danger zone,
   Block/Remove confirm, Report with reasons and "Also block"; `friends-more.ts` deleted; the
   status dot only on status lines; "In a match" vs "Waiting for you" status. Tests:
   `friends-section.browser.test.ts` (open sheet, block confirm, cancel keeps, report), the online
   `friends` flow, `friends-text.test.ts`. Shots: `M05`–`M10` for real. Amends the ADR 0079
   addendum of 2026-11-25.
6. **Take turns from the friend sheet.** By turns starts from "Take turns" (its lineup in place, as
   ADR 0085), the setup's Play row stays for links. Tests: `turns.online.test.ts` from the sheet.
   Amends ADR 0085.
7. **Play loses the strip.** `statusLine` and the strip go, the court gets its room, "N online"
   joins Friends' list title. Tests: requirement 4 (Play visible at 390 × 664) and a new one: the
   court at least 180 px there; `inbox-watch.browser.test.ts` (badge only). Shots: `M01`. Amends
   ADR 0081 (the status strip). (Owner's decision below on the green dot.)
8. **One incoming banner.** Challenge and rematch on one component (top on a phone, corner on a
   desktop; the bar; × = Later flying into the badge; reduced motion), no banner on Friends, "stopped
   waiting", no repeat of an ending already shown. Tests: `rematch-watch.browser.test.ts`,
   `inbox-watch.browser.test.ts` (fold, no duplicate on Friends, sender gone), the online
   `rematch-anywhere` and `friend-challenge` flows, `no-dead-end`. Shots: `M02`–`M04`. Amends ADR
   0070, 0081.
9. **Challenge lifecycle words and the crossed case.** Server: accepting a challenge from the person
   your own lobby waits for cancels your lobby in the same transaction (`challenges.ts`, a
   `*.db.test.ts` with two `TestBrowser`s); client: "You already challenged Jo" with Open it /
   Replace, a blocked sender's link says so, the leaver told, never a server sentence as a title.
   Tests: `challenges.db.test.ts`, `online-challenge-text.test.ts`, `online-failures` flow. ADR 0086.
10. **The friend lobby.** Waiting card first, Cancel as a button, the link folded. Tests:
    `online-challenge-text.test.ts`, the online flows' lobby steps. Shots: `M12`.
11. **By turns: Your games and endings.** Friends gains "Your games" (every open by-turns series,
    whose turn, time left) and an ended row until seen (a turn ran out, a series finished). Needs
    the inbox to carry open series and unseen endings (one statement, ADR 0081's "no new endpoint"
    holds) and a `seen` mark per player (a migration, expand only; `privacy.html` if stored).
    Tests: `inbox.db.test.ts`, `poke.db.test.ts` (an ending pokes once), `turns.online.test.ts`.
    Amends ADR 0085.

Each of 5, 7 and 8 runs `pnpm test:browsers` in all seven projects for its screens (the browsers'
CI jobs) and the online suite in CI.

---

## Decisions for the owner

1. **Friends online on Play**: nothing (recommended), or a small green dot on the Friends tab icon
   when anyone is online.
2. **Where the banner enters on a phone**: the top (recommended: covers only the header, iOS-like)
   or the bottom as today (thumb reach, but covers Free play and needs page room).
3. **Challenge from a row**: one inline Challenge when it can succeed (recommended) or none (all
   actions in the sheet; one more tap).
4. **What to play**: the × only (recommended) or keep the bottom Done only.
5. **The head-to-head line** in the friend sheet: build it (needs a query over finished series) or
   drop it from the design.
6. **Blocked player's link**: tell the blocker (recommended) or refuse the link outright.
7. **Crossed challenges**: auto-merge on Accept (recommended) or refuse a second challenge to
   someone who already challenged you ("Jo challenged you: Accept?").
8. **By turns "Your games"** now (with the playtest) or with ranked.

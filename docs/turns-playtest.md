# Play by turns: the two-phone playtest (ADR 0085, 0086)

ADR 0083's gate before ranked server work. Staging only: https://main--battle-ball.netlify.app
(`VITE_TURNS` and `BALLBATTLE_TURNS` are on there and in previews, never in production).

## What is built

- **Starting one**: a friend's sheet (Friends → tap their row) has **Play by turns** under
  Challenge · live, with its hint "No need to be online together · up to 24 h a move". When the
  friend is offline or in a match, Challenge · live stays visible but unavailable and says "Jo is
  offline · Play by turns instead"; Play by turns then takes the primary look. The vs Friend setup's
  "Play: By turns" row is still there for a link.
- **The lineup goes with the challenge**: the sender picks theirs, then **Send challenge**; the
  friend picks theirs after Accept, then **Accept challenge** goes straight into the series.
- **Waiting for you** (top of Friends): a by-turns challenge ("Alex challenges you", "… · take
  turns") with No thanks and Accept, and **"Your turn vs Alex · 22 h left"** with Play.
- **The Friends badge** counts what waits on you: turns, challenges and friend requests. Play shows
  nothing social (no strip).
- **Your games** (after Waiting for you): the games waiting on the _other_ player ("Alex's turn ·
  20 h left", Open). A game waiting on you is only in Waiting for you, never twice.
- **Endings** in Your games until that player opens the ended series ("You won vs Alex: their turn
  ran out", "You lost: your turn ran out", Open), for each player separately, for at most 7 days.
- **No banner for by turns**: the incoming banner is for live challenges and rematches only; a
  by-turns challenge waits in Waiting for you.
- **Pokes** (ADR 0082): every move or ending pokes both players' inbox and open series, so the other
  phone should update within a few seconds without a reload (staging measured ~2.4 s). The inbox
  still reads every 30 s while the page is visible, as a safety.
- **The clock**: 24 h a move. A turn that ran out is settled when either player's inbox or the
  series is read (staging has no sweep).

## Setting up (once)

1. Both phones: open staging, Friends → **Sign in** (email code or Google), choose a username.
   Use two different accounts (two email addresses).
2. Phone A: Friends → **Add a friend** → B's username or code. Phone B: Waiting for you → **Accept**.
3. Both: Friends lists the other, with a dot; "Friends · 1 · 1 online" while both are open.

## Step by step, two phones

| #   | Phone A does                                                                    | A should see                                                                                            | B should see                                                                                                      |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | Play tab → What to play: How **By turns** → Play → pick B → **Play B by turns** | the lineup for the challenge                                                                            | nothing yet                                                                                                       |
| 2   | Picks a lineup → **Send challenge**                                             | "Sent to B"; Your games doesn't list it yet                                                             | within seconds: the Friends badge goes up by 1; Waiting for you: "A challenges you · … take turns". **No banner** |
| 3   | (B) Accept → picks → **Accept challenge**                                       | the badge (if it's A's turn): "Your turn vs B" in Waiting for you                                       | the series screen                                                                                                 |
| 4   | Whoever is due taps **Play** and picks                                          | the series moves on; the row leaves Waiting for you and appears in Your games as "B's turn · 24 h left" | badge +1; "Your turn vs A" with Play                                                                              |
| 5   | Repeat until the series ends                                                    | an ending row in Your games ("You won vs B") until A taps Open                                          | the same, its own words, until B taps Open                                                                        |
| 6   | Open the ending                                                                 | the ended series; the row is gone (also after a reload)                                                 | B's row stays until B opens it                                                                                    |

Also try once per session:

- [ ] Reveal and Showdown (Blind is not offered by turns: live formats only), Best of 3 and 5.
- [ ] The other phone on Play, on Friends, inside the series, and locked (screen off) when a move
      lands. Note how soon each sees it.
- [ ] Close the app between turns; come back hours later: is "Your turn" there on opening?
- [ ] Two games at once with the same friend: two rows, no game in both lists.
- [ ] No thanks on a by-turns challenge: the sender's card says so.
- [ ] Let a turn run out (24 h): the late player loses, and each phone's ending says why.
- [ ] Back from the lineup (sender: the sheet; friend: the card). Reload on the lineup.
- [ ] Watch each round's replay ("Play round") and the fair-play check at the end.
- [ ] A live challenge in between still shows its banner and works as before.

## When something is wrong, note

- Which phone, browser and step (the table's #), and the time to the minute (the server's logs are
  by time).
- What each phone showed: the badge number, Waiting for you, Your games. A screenshot of both.
- Whether a reload fixed it (a missed poke) or not (a wrong answer from the server).
- Any "Try again" card, anything over a fight, a time left that looks wrong after hours away.
- Whether 24 h feels right, and whether you'd want a nudge when your turn comes (no push yet).

## Known limits (ADR 0085)

- The lineup has no URL of its own: a reload returns to the sheet, setup or card.
- Only accounts play by turns, with a friend (a guest's Play sends a live link); the inbox and
  "Your turn" are theirs too.
- No notification outside the open app.

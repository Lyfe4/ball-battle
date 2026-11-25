# Play by turns: the two-phone playtest (ADR 0085)

ADR 0083's gate before ranked server work. Staging only: https://main--battle-ball.netlify.app
(`VITE_TURNS` and `BALLBATTLE_TURNS` are on there and in previews, never in production).

## Setting up (once)

1. Both phones: open staging, sign in (email code or Google) and choose a username.
2. Phone A: Friends → Add a friend → B's username or code. Phone B: Friends → Accept.

## Starting a game

1. A: Friends → B's row → **Challenge** → the vs Friend setup.
2. **Play: By turns** (Live is the default) → length and format → **Choose lineup** → pick →
   **Send challenge**. A's card says "Sent to B".
3. B: Play's strip says "1 challenge…" (no pop-up card for by turns) → tap it → Friends → Waiting
   for you → **Accept** → pick → **Accept challenge** → the series.
4. Whoever is due: Play's strip says "Your turn vs …"; tap → Friends → **Play** on that row.

## What to try

- [ ] Each format: Reveal, Showdown (both pick round 1), Blind is not offered (live formats only).
- [ ] Best of 3 and Best of 5.
- [ ] Take a turn with the other phone on Play, on Friends, inside the series, and locked (screen
      off). How soon does each see it's their turn? (Staging measured ~2.4 s by poke.)
- [ ] Close the app between turns, come back hours later: does "Your turn" show on opening?
- [ ] Two games at once with the same friend (Play's strip says "Your turn in 2 series").
- [ ] No thanks on a by-turns challenge; the sender's card says so.
- [ ] Let a turn run out (24 h): the late player loses; does each phone say why? (Settled when
      either player opens the app; staging has no sweep.)
- [ ] Back from the lineup (sender: the setup; friend: the card). Reload on the lineup.
- [ ] Watch each round's replay ("Play round"); the fair-play check at the end.
- [ ] A live challenge still works the same in between.

## What to watch for

- A turn that never shows as yours, or shows on one surface (strip, badge, row) but not another.
- The badge count against what Waiting for you lists.
- Times left that look wrong after hours away (the row says "22 h left").
- Anything that pops up over a fight; any console error or "Try again" card.
- Whether 24 h feels right, and whether you'd want a nudge when your turn comes (no push yet).
- Which screen you'd expect to start one from: the friend row's Play row, or the Play sheet.

## Known limits (ADR 0085)

- Starting by turns is on the vs Friend setup only; the Play sheet stays live.
- The lineup has no URL of its own: a reload returns to the setup or the card.
- Guests can send a by-turns link, but only accounts get the inbox and "Your turn".
- No notification outside the open app.

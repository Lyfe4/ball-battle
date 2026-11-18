# 0069: The privacy policy and terms, as pages of their own, written from the code

- Status: Accepted
- Date: 2026-11-18
- Builds on: ADR 0052 ("Before launch: minimal data, our own policy and terms, deletion, 16+"),
  ADR 0068 (the production project, the inactive-guest cleanup)

## Context

ADR 0052 put a privacy policy and terms of service on the launch checklist, drafted with Claude
for the owner. The owner drafted both, marking each claim to verify with `[check]`. Before a beta
of vs Friend on the live site, every claim had to match what the code and the hosted settings
really do, and the pages had to be in the game: linked from the 16+ question and quietly from home.

## Decision

### Static pages, built with the game

`/privacy.html` and `/terms.html` are plain HTML pages built by Vite beside `index.html`
(`vite.config.ts`), styled from the game's own tokens and font (`src/legal/legal.css`), with no
script.

- They read without the game: a stable address for the app stores and for anyone sent the link,
  and nothing to break on an old browser.
- The game's bundle and routes are unchanged; a reading page needs no state, so Back is the
  browser's own. Each page leads back to the game and to the other page (no dead ends).
- Phone first: one column, a chunky way back at the top. On a desktop the way back sits in a
  column of its own beside the text, which keeps a readable line length.
- Linked from the 16+ question (opening in a tab of its own, so the question stays where it was)
  and from home's footer, beside Source on GitHub.
- Not taken: in-game screens (`?view=privacy`). They would need the game's script to read a
  policy, and a route, a screen key and history rules for what is only reading.

### Every fact, and where it comes from

| The policy says                                                           | Source                                                                               |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Offline play sends nothing; settings live in the browser                  | Every `ballbattle.*` key is `localStorage`; the only other fetch is `new-version.ts` |
| A guest is an id, a made-up name, the 16+ time, last seen                 | `game.profiles` (migration `20261114213106`)                                         |
| The IP is recorded with the guest's sign-in session                       | `auth.sessions.ip`, measured on staging and production (ADR 0068)                    |
| Its user agent is not the player's                                        | `auth.sessions.user_agent` is `node`: our functions call Auth                        |
| No Auth audit log                                                         | `auth.audit_log_entries` empty on both projects (2026-11-18)                         |
| Guests per network are counted under a keyed hash, for an hour            | `rate-limit.ts` (`ipSubject`, HMAC; windows purged by the sweep)                     |
| Matches stay as "Deleted player"                                          | `on delete set null` on `game.series`; the forfeit trigger                           |
| Live presence is kept with the match                                      | `game.presence` (series and side, no user id)                                        |
| Only a hash of a challenge link is kept; it works while the lobby is open | `game.challenges.token_hash`; `LOBBY_SEEN_MS`                                        |
| 90 days without playing, then deleted                                     | `INACTIVE_DAYS` (`src/server/inactive.ts`, ADR 0068)                                 |
| The cookie                                                                | `__Host-bb_session`, 400 days, but useless once the guest is deleted                 |
| Database in Sydney; server code in Ohio                                   | Supabase `ap-southeast-2`; Netlify's functions region `us-east-2` (Free plan)        |
| No other service                                                          | `SENTRY_DSN` is unset in every context                                               |
| Leaving, being away about half a minute, or missing the start loses       | `GRACE_MS`, `START_WINDOW_MS` (`src/api/live.ts`); a timed-out pick is random        |

`scripts/legal-pages.test.ts` reads the pages back against the constants that decide them, so
a change to either fails until both agree. The 16+ card says the same in short.

### Corrections to the owner's draft

1. **Offline:** the game sends nothing, but loading any page shows Netlify the player's IP, and the
   game checks for a newer version. Said so.
2. **How long a guest lasts:** "until Forget me, or [check]" is now "or 90 days after you last
   played online", which needed the cleanup to be built (ADR 0068).
3. **Matches:** they are not deleted with the guest. They stay in the opponent's history as
   "Deleted player", unlinked, with no end date. Also listed: the times, why a match ended, and
   rematches.
4. **Last seen:** two things, not one: the day the guest last played online (for the 90 days) and
   their check-ins during a live match (kept with the match).
5. **IP address:** not only for limiting guests. Supabase Auth stores the full IP with the guest's
   sign-in session until the guest is deleted. The per-network limit stores only a keyed hash of
   the network, deleted when its hour or day ends.
6. **Challenge links:** live links work only while the sender's lobby is open, not 7 days (that
   was play by turns, hidden); only a hash of the link is kept, and its record goes with the
   guest.
7. **Who else:** Supabase also runs the sign-ins, and both are US companies. Netlify's functions
   run in Ohio because the Free plan can't choose a region, so every online request passes
   through the United States. No other service is used.
8. **Forget me:** it deletes the guest, profile, session with its IP and challenge links at once,
   forfeits a match in progress, and leaves finished matches as "Deleted player". The draft said
   it deletes "your matches". It also clears the browser's game data.
9. **Terms, item 3:** "results that fail the check don't count" became "the server plays every
   match itself": the client never submits a result.
10. **Terms, item 4:** "away for more than about 30 seconds" is right (6 s, then 30 s of grace);
    added: not turning up within a minute of the start loses, and a pick that runs out is random,
    not a loss.
11. **The 16+ card in the game** said "nothing else" is kept and that Forget me "deletes it all".
    It now names the IP, says finished games stay as "Deleted player", and links both pages.

## Consequences

- Turning on Sentry (`SENTRY_DSN`), adding accounts, or changing a retention constant changes the
  policy in the same pull request, with a new date.
- The pages go live with the next Publish, whether or not vs Friend is switched on.

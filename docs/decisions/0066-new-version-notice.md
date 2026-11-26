# 0066: A tab on an old build says so, at a calm moment

- Status: Accepted
- Date: 2026-11-18
- Builds on: ADR 0042 (a series survives a reload), ADR 0053 (live matches are the server's)

## Context

Built assets are cached for good (`/assets/*` is `immutable`) and only a reload fetches a new
`index.html`, so a tab left open across a deploy runs the old build indefinitely (issue #17). It
has caused false bug reports more than once: feedback about UI that was already gone.

## Decision

**What is compared.** Every build's `index.html` names its script and stylesheet by content hash.
The page compares the `/assets/` URLs it loaded with the ones a fresh `index.html` names
(`src/app/build-check.ts`, pure). No version file and no build step: any change to what ships
changes a name (a chunk's hash covers the chunks it imports). A page that names no built assets
(an error page, a Wi-Fi sign-in page) says nothing; under the dev server nothing is checked.

**When it asks.** When the tab comes back into view (`visibilitychange`) and when home opens, at
most once a minute and never on a timer, the first a minute after loading. One request for a
4 kB page (about 1.5 kB compressed), static, no function, `cache: 'no-store'`; failures are
silent. A tab nobody looks at costs nothing.

**When it shows.** Only at a calm moment (`isCalmMoment`): home, or an offline series that is
over. Never during a fight, a setup, or on the online screens, even after a live match ends (a
rematch can be on its way). Found mid-fight, it waits for the next calm moment.

**What it shows.** One card, "A new version of BallBattle is ready." with Reload, in the notice
surface the slow-frames line uses. It floats at the bottom (the whole column on a phone, the
corner on a desktop), so it never moves what is on screen, and the page gains room under its end
while it shows, so it never covers the last thing on a page. It is a polite status, written as it
shows, so a screen reader hears it once. No Dismiss: it only appears on calm screens and goes
away with the reload; a player who ignores it loses nothing.

**Nothing is lost by a reload.** A series against the bot is saved after every change and
restored after a reload (ADR 0042); home holds an undecided one. A live match is the server's:
the card never shows on its screen, and from home a reload comes back to "Back to your match"
from `/me/match`, well inside the 6 s before a player shows as away.

Rejected: a service worker (a large new moving part for one line of text); polling (costs while
nobody looks); the build hash in the manual's footer only (feedback could name it, but the player
would still be on the old build).

## Consequences

- Positive: a tab open across a deploy says so the next time its player comes back to it.
- Negative: a deploy that changes only `public/` files (icons) isn't announced; nothing there
  changes how the game plays.

## Addendum (2026-11-26): the false alarm after every game

The owner saw "A new version of BallBattle is ready." after nearly every game on staging, more on a
phone. Staging was rebuilt several times that day, but the card came without a deploy too: since
the font preload (ADR 0087, 2026-11-25) the served `index.html` names three `/assets/` files (the
script, the stylesheet and `<link rel="preload" as="font">`), and `assetsOf` counted every
`/assets/` URL in a `<script>` or `<link>` while the page's own count (`loadedAssets`) reads only
scripts and stylesheets. The two lists never matched, so the first check a minute after loading
(home after a game, or the phone's tab coming back into view) always "found" a newer build.

- **One rule on both sides**: `assetsOf` counts a `<script src>` and a `<link rel="stylesheet">`
  only, as `loadedAssets` does; a preload or module preload is not what the page ran.
  `build-check.test.ts` checks the served head (with the font preload and a module preload) as the
  same build and a changed script behind them as new; `update-notice.browser.test.ts` parses that
  head and checks both counts agree.
- **Logged**: when a newer build is found, the console says what was compared (`loaded`,
  `deployed`), once per page.
- **The back/forward cache**: a page a phone restores from it (`pageshow` with `persisted`) checks
  as one coming back into view does, at most once a minute as before.
- Unchanged: a calm moment only, once per page (a found build is never asked about again), no
  timer.

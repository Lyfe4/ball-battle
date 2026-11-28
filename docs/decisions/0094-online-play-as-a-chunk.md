# 0094: Online play loads as a chunk of its own

- Status: Accepted (2026-11-28, after launch)
- Date: 2026-11-28
- Builds on: ADR 0052 (online play only in builds with it), ADR 0054 (skeletons, busy buttons),
  ADR 0087 (static content first, nothing jumps, the budget), the 2026-11-28 audit (section 6,
  item 2)

## Context

In an online build (previews, staging, production once vs Friend is on) the page's one script held
every online screen: about 168 kB gzipped, about 36 kB of it online play (`online-mount.ts` and all it
alone imports). A player who never plays a friend downloaded and ran it before the first paint.
The Balls manual had already moved to a chunk asked for as the page starts (`manual-lazy.ts`).

Online play is wider than the manual: eight screens, Play's place on home, the avatar, settings'
Forget me, the inbox and rematch watches, and what the arena asks of a live series each frame.

## Decision

1. **`mountOnline` is a chunk; `lazyOnline` (`online-lazy.ts`) stands in for it.** main.ts holds
   the stand-in in an online build (`offlineMount` stays as it was elsewhere), which asks for the
   chunk as the page starts, so it is nearly always there before any tap and a page that goes
   offline later still has it. Builds without online play hold neither (the import is behind the
   build's own condition, `check-bundle.ts` checks).
2. **An online screen never shows without its code.** `OnlineMount.ready(screen)` is undefined
   when a screen can show now, else a promise; main.ts's `showCurrentRoute` waits on it, keeping the
   screen on show until then, and the last move asked for wins. A cold link to an online screen
   lays out its first paint once the chunk has come (the stage is drawn invisible until then,
   first-paint.ts), and the screen then draws its own skeleton as before. No stand-in skeletons:
   a second skeleton that a real one replaces would move.
3. **What shows from the first frame is drawn by the stand-in as the mount would**: Play's place
   (waiting on a device that has played online, `showPlayRow`), the avatar (passed into the mount)
   and Forget me (settings are made before the chunk comes). The error reports start with the page.
4. **A chunk that fails to load** shows the one failure notice in the screen's place, its own
   header (the Friends tab keeps its tab header) and Try again, which asks again and shows the
   screen (`online-unloaded.ts`); Play stops waiting. When the chunk comes the mount takes over and
   the page is laid out again so it sees the screen on show.
5. **The first script has a budget of its own**: 140 kB gzipped (`bundle-budget.ts`), beside the
   180 kB for all scripts, so online code creeping back into it fails the build.

## Consequences

- The online build's first script: about 168 to 132.4 kB gzipped; the chunk is about 38 kB, and all scripts together grow by about 2 kB (172.4 to 174.3 kB of the 180 kB budget). A build setting folds the build switches into conditions across chunks (`inlineConst`, two passes), or the chunk kept sign-in code an online build without accounts must not hold.
- A cold link to an online screen costs one more request before its first paint (the chunk, asked
  for as soon as the first script runs); a stalled chunk shows the page's own reload line at
  `--boot-safety`, as a stalled first script does.
- A move to an online screen in the moment before the chunk has come keeps the old screen a moment
  longer; no button says so (the chunk is asked for at start, so this is rare).
- Flows on an online build wait for the chunk in `openAs` (`shell-routes-support.ts`).

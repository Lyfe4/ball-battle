# 0078: Deleting a guest never waits on the vs Friend switch

- Status: Accepted
- Date: 2026-11-21
- Amends: ADR 0068 ("The vs Friend switch": off, the functions answered nothing and the build held
  no online code)
- Builds on: the owner's decision of 2026-11-21, after the pre-launch audit

## Context

The privacy policy (ADR 0069) promises two ways a guest is deleted: Forget me, and the cleanup
of guests not seen for 90 days. Both hung on the vs Friend switch. With it off every function
answered 404 `online_off`, the scheduled sweep included, and the production build held no online
code, so Forget me was gone from settings. Switching vs Friend off after a beta would have kept
every guest, and the IP Auth records with its session, for as long as the switch stayed off.

## Decision

**The server.** `configOf` reads the settings whenever a deploy has them all, and says whether
online play is on (`Config.online`, from `BALLBATTLE_ONLINE`). Production keeps its secrets with
the switch off (ADR 0068), so it has a configuration either way. With the switch off a route
answers `online_off` unless it deletes players (`alsoWhileOff` in `http.ts`):

- `DELETE /api/v1/me`, Forget me;
- the scheduled sweep, so the 90-day cleanup and the rate-limit purge keep their schedule. With no
  live play there is nothing else for it to settle.

Everything else answers `online_off` as before, `/api/v1/health` included: the friend switch
reads its 404 as off. A deploy without the settings has no configuration and answers
`online_off` to everything, as before. A partial set with the switch off counts as none, rather
than turning every answer into a 500.

**The client.** Every build offers Forget me in settings on a device that has a guest. Its one
request lives in `src/screens/forget-me-host.ts`, shared by both builds, and the bundle check
(`scripts/check-bundle.ts`) lets a build without online play hold exactly `/api/v1/me` and
nothing else of the API. callApi's `/api/v1/${path}`, or any other route, still fails the
build.

Not taken: a page of its own (`/forget.html`) for deleting a guest. It would be a second way to do
the same thing, outside settings where the policy points, and it would need the same exception to
the bundle check.

## Consequences

- With vs Friend off, production's functions still need their database and Auth settings for
  deletion to work. Removing them stops the cleanup and Forget me answers "Online play is not
  switched on here"; the policy would then need to say email is the only way.
- The off build is about 3.5 kB bigger (Forget me's group in settings and its request).
- A guest who opens the game while the switch is off isn't "seen", so their 90 days keep
  running, as the policy says ("While vs Friend is on, just opening the game counts").

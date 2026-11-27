# Architecture

A one-page map of BallBattle, from the tick to the database. The rules behind each part are in
[CLAUDE.md](CLAUDE.md); why each was chosen is in [docs/decisions](docs/decisions/README.md).

## The pieces

```
 Browser (static site, Netlify CDN)                 Netlify functions (Node 24)            Supabase
 ───────────────────────────────────                ───────────────────────────            ────────
 main.ts ── wires screens, routes, history           netlify/functions/*.ts                 Postgres (Sydney)
   │                                                   │ one thin file per route            game schema: profiles,
   ├─ screens/   one module per screen's wiring        ▼                                     series, starts,
   ├─ ui/        plain DOM, read-only views          src/server/routes/*  guard + session    challenges, friendships,
   ├─ arena.ts   the match on screen, rAF loop         ▼                                     rate_limits, presence…
   │    ├─ render/   draws sim state (Canvas 2D)    src/server/*  services (rules)            ▲
   │    └─ sound/    sounds from the arena's ticks     ▼                                     │ one pooled connection
   ├─ app/       small pure browser helpers         src/server/db/*  SQL, one statement     │ per function instance
   └─ sim/  ◄── the same pure sim, deterministic       per answer where it can ─────────────┘
              │                                     rulesets/r<N>/sim.mjs  frozen sims that  Auth (anonymous guests,
              └─ api/  types both sides agree on      verify every series                    email codes, Google)
                                                                                             Realtime (pokes)
```

- **`src/sim/`** is the game: a pure, deterministic fixed-step simulation (60 ticks a second, a
  seeded PRNG, no DOM, clock or transcendental maths). The browser plays it; the server replays
  it to verify a series. Its public API is `src/sim/index.ts`.
- **`src/render/`, `src/ui/`, `src/sound/`** only read sim state and events. Presentation time
  (hit-stop, slow motion, the intro) bends; sim time never does.
- **`src/screens/`, `src/app/`, `main.ts`** are the page: routing (`app/route.ts`, URL first:
  every match is a link), history rules (`app/history-rules.ts`), a series saved across a reload
  (`app/series-save.ts`), and each screen's wiring.
- **`src/api/`** is the contract: request and view types, decoders that take `unknown` and never
  throw, live timers, fairness checks.
- **`src/server/`** is the API behind `/api/v1/*`: every route starts with `guard` (method and
  CSRF) and `sessionOf`/`sessionWith` (the session cookie's JWT, verified locally, and the Auth
  session still signed in, ADR 0092). Rules live in services; SQL in `db/`. Times in rules are the
  database's `now()`.
- **`rulesets/`** holds each ruleset's frozen sim bundle and known results. A series is played and
  verified only by its own ruleset's bundle, so old links keep working after a balance change.

## Two flows to follow

**A tick.** `arena.ts` asks `app/fixed-step.ts` how many ticks this frame owes, calls
`step(world, definitions)` (`sim/step.ts`) for each, which returns a new world and events; the
renderer interpolates between the last two worlds, effects and sounds read the events. Nothing
feeds back into the sim.

**A live friend match.** The page sends a challenge (`POST /challenges`); the friend accepts; both
pick lineups at once (`/starts`); the server makes the series and its secret seeds. Each phone
reads `GET /series/:id` (a heartbeat every ~2 s, faster while the other can move); a pick is
`POST /series/:id/picks`. Between reads, the database pokes each player's own Realtime topic when
something they read changed (`20261124120000_poke.sql`), and the page reads at once. The server
times each fight; both phones start it from the server's clock. A sweep (every 15 minutes) settles
what nobody reads any more and deletes players away too long.

## Where things run

| Piece                    | Staging (`main`)                    | Production (`release`)                   |
| ------------------------ | ----------------------------------- | ---------------------------------------- |
| Site and functions       | `main--battle-ball.netlify.app`     | `battle-ball.netlify.app`                |
| Database, Auth, Realtime | Supabase `ballbattle-staging`       | Supabase `ballbattle-production`         |
| Migrations               | Migrate staging workflow, each push | Publish workflow, before `release` moves |
| Switches                 | all on                              | see `docs/launch-checklist.md`           |

Deploys: merging to `main` builds staging. Nothing reaches production until the Publish workflow
fast-forwards `release` to a green `main` commit, after migrating production. Rollback: Netlify's
previous production deploy; migrations are expand only, so the old code runs on the new schema.

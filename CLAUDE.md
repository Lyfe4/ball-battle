# BallBattle

Browser auto-battler: balls with different abilities bounce around a square arena with health
bars until one wins. No player control; you pick balls and watch. This is a portfolio piece, so
code quality matters as much as features.

Where it's heading (PvP best-of-3 with blind lineups, soft counters): `docs/vision.md`. Best of 3
against a bot is built (ADR 0017), and Best of 5 beside it (ADR 0048: five balls, first to three,
chosen and remembered on Other modes), with three draft formats (blind, reveal with turns showing
first after a seeded coin toss, and showdown; ADR 0019, 0021, 0029, 0035) and three bot levels
(ADR 0035, `src/sim/bot.ts`). Reveal is the main mode (ADR 0046): home's Play opens its lineup in
one tap, and every other way to play is on Other modes (`src/app/modes.ts`). The rules and the bots are pure sim code in `src/sim/series.ts` and
`src/sim/bot.ts`, the same functions a server would run to verify a series, so keep them
deterministic and DOM-free.

Stack: TypeScript (strict), Vite, pnpm, Vitest, ESLint (flat config) + Prettier, Husky +
lint-staged, plain HTML Canvas 2D. No game engine, no physics library, no React.

## Commands

- `pnpm dev`: start the Vite dev server on http://localhost:5199. `/styleguide.html` shows every
  ball design in each ability state, large and at phone size, and the shared UI parts (dev only,
  not in the build); `?only=ui` shows just the UI parts, `?only=phone-arena` the phone arena.
  `/brand.html` (dev only) draws the icons and the link-preview image with the game's renderer;
  save each canvas as the `public/` file it names and commit it
- `pnpm build`: typecheck and build to `dist/`
- `pnpm preview`: serve `dist/` on http://localhost:4199 with the production security headers
  from `scripts/security-headers.ts` (Netlify serves the same set from `netlify.toml`; a test keeps
  them in step). Check the console for CSP errors after any change that loads something new.
- `pnpm test`: run the fast unit suite once (`pnpm test:watch` to watch)
- `pnpm test:slow`: the slow suite (`*.slow.test.ts`, one file per concern so they run in
  parallel): roster-wide tests that play every matchup for whole matches (determinism, the
  measured pass-through margin, the measured identity rules). Run it after changing any ball or
  the combat rules. Roster-wide tests that play whole matches go here, in the file for their
  concern; their helpers are in `src/sim/balls/roster-support.ts`.
- `pnpm test:browsers`: the known match results (`src/golden`, ADR 0023) and flows through the
  real page (`src/**/*.browser.test.ts`, ADR 0025) in headless Chromium, Firefox and WebKit
  through Vitest's Playwright provider. A flow that needs a desktop screen is
  `*.wide.browser.test.ts`, run at a fixed 1280 x 800 (project `browsers-wide`): never resize the
  viewport during a test, which upsets later files' history in WebKit. A flow on a touch phone is
  `*.touch.browser.test.ts` (project `browsers-touch`: touch on, 375 x 812, and a `tap` command
  for real taps, ADR 0037). A flow that must also hold on a full HD screen is
  `*.full.browser.test.ts` (project `browsers-full`, 1920 x 1080, ADR 0038). Two more phone sizes
  run with touch (ADR 0039): `*.iphone.browser.test.ts` (project `browsers-iphone`, 390 x 844) and
  `*.safari.browser.test.ts` (project `browsers-safari`, 390 x 664: what Safari leaves of that
  iPhone with its toolbars shown, where a layout that fits the full screen can still squeeze the
  court). Needs the browsers once:
  `pnpm exec playwright install chromium firefox webkit`.
- `pnpm lint`: ESLint
- `pnpm typecheck`: `tsc -b` over every tsconfig project
- `pnpm format` / `pnpm format:check`: Prettier
- `pnpm balance [seeds] [--ball <id>] [--serial]`: play every matchup (both slot orders, seeds
  0..N-1) headlessly across all CPU cores and print the matchup matrix and whether the balance
  targets are met. Run it after changing any ball's stats, ability or the combat rules.
  `--ball <id>` plays only that ball's matchups and mirror (for a new ball); `--serial` runs on one
  thread and gives byte-identical output. The elapsed time goes to stderr. Exits with 1 on any
  MISS.
- `pnpm golden`: rewrite the known match results (`src/golden/golden-matches.json`, ADR 0023)
  after a `RULESET_VERSION` bump. It refuses while the version is unchanged: results that move
  without a bump are a bug to find, not a record to update.
- `pnpm balance:summary`: a full `pnpm balance` that also writes each ball's shape (win rate;
  strong, even and weak matchups by the map and measured, with average win rates) to
  `docs/balance-summary.md`, with each ball's counters and the known gaps. Regenerate and commit it
  after any change to a ball or the combat rules. `pnpm balance` prints the same summary and fails
  on any ball off its shape (ADR 0045, group 4).
- `pnpm balance:ci`: the reduced check CI runs: 150 seeds, no sensitivity runs, and a counter-map
  pair fails only when clearly outside its band (ADR 0011 addendum). A full `pnpm balance` still
  judges borderline pairs.

CI runs `format:check`, `lint`, `typecheck`, `test` and `build` in one job, `test:slow` in a second,
`balance:ci` in a third and `test:browsers` in a fourth. All must pass.

## Architecture rules

1. **`src/sim/` is a pure, deterministic simulation**: no DOM, no `Date`, no `Math.random`, no
   timers. Enforced by `tsconfig.sim.json` (no DOM lib, no ambient `@types`) and ESLint rules in
   `eslint.config.js` that also ban transcendental `Math` functions (`sin`, `cos`, `atan2`, `pow`,
   `exp`, `log`, ...) and the `**` operator, because their results can differ between JS engines.
   `+ - * /` and `Math.sqrt` are exact under IEEE 754 and safe. `src/sim` must not import from
   `src/render` or `src/main.ts`.
2. **Fixed timestep**: the simulation advances in ticks of exactly `DT = 1 / 60` seconds. Same
   inputs + same seed = identical result, bit for bit.
3. **Randomness only from the seeded PRNG** (mulberry32) in `src/sim/rng.ts`. Its state lives in
   `WorldState.rngState`, so a world snapshot fully determines the future.
4. **`src/render/` only reads sim state and draws it.** Rendering never mutates state. Transient
   effects (like the damage flash) are driven by sim events and kept in the render layer
   (`src/render/effects.ts`), never in `WorldState`. `src/ui/` is the plain-DOM HUD, under the
   same read-only rule.
5. **`src/main.ts` wires it together** with a `requestAnimationFrame` loop that uses an
   accumulator to run the fixed timestep independently of display refresh rate. Browser-side
   helpers that are not sim or rendering (the fixed-step clock, the presentation clock and frame
   driver, seed and matchup parsing, routes) live in `src/app/` as small pure functions with tests;
   keep `main.ts` to wiring. The match on screen and the frame loop are `src/arena.ts`; history is
   `src/app/navigation.ts` (given `window`, so it is tested with a fake history). Each screen's wiring has its own module: `home-controller.ts`,
   `quick-controller.ts`, `series-setup.ts` and `series-controller.ts` (joined in
   `series-screens.ts`, which is also the router's series handler), `manual-screen.ts`,
   `modes-screen.ts`. A new screen gets its own module like them, a route in
   `src/app/route.ts` (ADR 0020) and a test for its link.
6. **Balls are data-driven definitions**, one file per ball in `src/sim/balls/`, created with
   `defineBall` and listed in `src/sim/balls/index.ts`. A `BallDefinition` is plain data plus
   optional hooks. Runtime state (`BallState`) is kept separate from the definition.
7. **Abilities are hooks that return actions** (ADR 0003). Hooks (`onTick`, `onWallHit`,
   `onHitBall`, `onDamageDealt`, `onDamageTaken`) get a read-only context and return `AbilityAction`s; `step`
   applies them. Hooks never mutate anything and never use `Math.random`: randomness comes from
   `ctx.random()`. A ball's own ability state is typed per definition and declared as
   `type XState = Readonly<{ ... }>` (an interface won't satisfy the serialisable index signature).
   New action kinds go in the `AbilityAction` union and the exhaustive switch in
   `src/sim/abilities/apply-actions.ts`.
8. **`step(world, definitions)` returns `{ world, events }`.** Definitions stay out of
   `WorldState` (they can hold functions); pass the same lookup every tick. Events are output
   only and never feed back into the sim: anything the sim must remember (health, contacts,
   match state) lives in `WorldState`. A finished match is returned unchanged with no events.
9. **Battle feel bends presentation time, never sim time** (ADR 0007). Hit-stop, slow-mo and the
   intro change when ticks run, never which ticks run. Effects run on effect time, are driven by
   sim events, and respect `prefers-reduced-motion`. `src/sim` must not change for feel work.

The reasoning is in `docs/decisions/0001-deterministic-simulation.md`,
`docs/decisions/0002-combat-core.md`, `docs/decisions/0003-ability-system.md`,
`docs/decisions/0004-wall-bounce-variance.md`, `docs/decisions/0005-projectiles.md`,
`docs/decisions/0006-hazard-zones.md`, `docs/decisions/0007-presentation-clock.md`,
`docs/decisions/0008-size-directness-cruise-speed.md`, `docs/decisions/0009-status-effects.md`,
`docs/decisions/0010-counter-map.md`, `docs/decisions/0011-roster-scaling.md`,
`docs/decisions/0012-slowed-poisoned-damage-taken.md`, `docs/decisions/0013-thorns-brawler-counter.md`,
`docs/decisions/0014-venom-thorns-counter.md`, `docs/decisions/0015-berserker-sniper-quake.md`,
`docs/decisions/0016-counter-density.md`, `docs/decisions/0017-best-of-3-series.md` and
`docs/decisions/0018-aimed-start.md` (measured in `docs/aiming-measurements.md`; removed, since
aiming created no skill), `docs/decisions/0019-draft-formats.md`,
`docs/decisions/0020-screens.md`, `docs/decisions/0021-reveal-take-turns.md` (measured in
`docs/reveal-measurements.md`), `docs/decisions/0022-ruleset-version-and-verified-series.md`,
`docs/decisions/0023-known-match-results-across-engines.md`,
`docs/decisions/0024-player-facing-text-stays-in-definitions.md`,
`docs/decisions/0025-show-less-and-back.md`,
`docs/decisions/0026-magnet-ghost-necromancer.md`, `docs/decisions/0027-phone-play-fixes.md`,
`docs/decisions/0028-counter-pass.md`, `docs/decisions/0029-reveal-coin-toss.md`,
`docs/decisions/0030-symbol-tooltips-and-result-fixes.md`,
`docs/decisions/0031-desktop-layouts.md`, `docs/decisions/0032-sticker-pop-restyle.md`,
`docs/decisions/0033-arena-polish.md`, `docs/decisions/0034-chrono-titan-inferno.md` and
`docs/decisions/0035-bot-levels-and-showdown.md` (measured in `docs/series-measurements.md`),
`docs/decisions/0036-teaching-in-the-arena.md`, `docs/decisions/0037-clarity-fixes.md`,
`docs/decisions/0038-one-look-per-screen-state.md`,
`docs/decisions/0039-the-phone-arena-is-the-screen.md`, `docs/decisions/0040-settings.md`,
`docs/decisions/0041-the-spark-marks-the-counter.md`,
`docs/decisions/0042-reload-safe-series.md`,
`docs/decisions/0043-boomerang-bomber-guardian-bloom.md` and
`docs/decisions/0044-one-story-look-and-settings-off-the-court.md` and
`docs/decisions/0045-roster-redesign.md` (the roster redesign, group by group; the design is
`docs/roster-redesign.md`) and `docs/decisions/0046-reveal-first-home-and-other-modes.md` and
`docs/decisions/0047-spartan-and-bloom-pause.md` and `docs/decisions/0048-best-of-5.md` and
`docs/decisions/0049-hex-spider-phasing-ghost.md`.

## Workflow

- Work on a branch and open a pull request; never commit to `main` directly. Once every CI check on
  the pull request passes, merge it yourself with a merge commit (keep the individual commits, no
  squash), then delete the branch. If a check fails, fix it on the branch first: never merge a red
  pull request. "Every CI check" means the four CI jobs and Netlify's deploy preview. Netlify's
  header rules, pages changed and redirect rules checks are informational and can stay pending, so
  don't wait on them (a failure in one is still worth a look).

## Conventions

- **Bump `RULESET_VERSION` (`src/sim/ruleset.ts`) in the same commit as any change that can change
  a fight, a bot's choice or a series**: stats, abilities, combat rules, the counter map's sides,
  the roster or its order, seeds and salts (ADR 0022). `ruleset.test.ts` fails until you do; add
  the new fingerprint to its table and never edit an old one, then run `pnpm golden`. Links from other rulesets show a
  notice instead of replaying a different fight.
- Whether a series setup is valid is decided by `verifySeries` (`src/sim/series-verify.ts`) alone:
  `playSeries`, the browser's route, a saved series after a reload (ADR 0042) and a future server
  all use it. Don't add a second check.

- `step` is pure: it returns a new `WorldState` and never mutates its input. Sim types are
  `readonly`.
- Within a tick: statuses due this tick expire (ADR 0009), onTick, move (with a seeded turn on wall
  bounces, ADR 0004), onWallHit, collide (a phased ball passes through, ADR 0026), contact damage
  (new contacts only, scaled by directness, ADR 0008), onHitBall, minions move and pop (ADR 0026),
  projectiles move and resolve (a returning one turns and homes on its owner, ADR 0005, 0043), zones
  due this tick strike (a lasting zone pulses on its rhythm; a bomb an enemy ball touched strikes
  early), apply their status and clear enemy minions (ADR 0006, 0009, 0026, 0034, 0043), poison ticks
  (ADR 0012), onDamageDealt, onDamageTaken (ADR 0012; damage from its actions fires no further
  hooks), onKnockedOut for balls just brought to 0 (a `rewind` puts one back, ADR 0034), defeat,
  cruise speed (ADR 0008, reduced while slowed) then size (`radiusOf`, ADR 0034), match end. Events are emitted in that order. Every hook in a phase sees the
  same snapshot; actions are applied afterwards. Wherever damage lands, the target's `incomingDamageOf`
  (armor, a fade) takes its share first (ADR 0045). The full order is documented on `step`.
- Status effects (ADR 0009) live on `BallState.statuses`, come only from the `applyStatus` action
  or a zone's `status`, refresh rather than stack, and expire at the start of their expiry tick.
  A new kind extends `StatusKind` in `src/sim/status.ts`. A ball that shrugs a status off declares
  `statusResistance` (the share of the duration it keeps, 0 for immune; ADR 0016) rather than
  checking for it in hooks.
- Every ball keeps its own speed: the tick ends by rescaling each live ball's velocity to its
  cruise speed, so collisions only change direction. An ability that changes how fast a ball goes
  declares `cruiseSpeed(state, stats)` on its definition instead of setting velocity in hooks.
- An ability that turns another ball uses the `steer` action (direction only, ADR 0026); a ball
  that passes through others declares `phasedOf(self)` (nothing touches it then: balls, shots,
  skulls and bombs pass through, but it is still aimed at and pulled, ADR 0049); summoned objects are minions
  (`src/sim/minions/`), not balls. Aimed attacks pick their target with `nearestTarget`, which
  includes enemy minions, so every aimed ball treats them alike.
- A ball that takes less of a hit declares `incomingDamageOf(self, amount, tick)` (ADR 0045: the
  Spartan's planted shield, ADR 0047; the phased Ghost, ADR 0049), applied on both damage paths and shown by a `hitReduced`
  event, rather than healing damage back in a hook. A projectile that comes back uses
  `returnAfterTicks`; a zone an enemy ball can set off declares a `trigger` (swept,
  so no speed skips it).
- An ability that changes how hard a ball hits declares `contactDamageOf(self, stats)` (ADR 0015)
  rather than adding a `damage` action on hit: contact damage goes through directness, the
  lethal-exchange tiebreak and Thorns' reflection; an on-hit ability bonus skips all three.
- Every ball uses `STANDARD_BALL_RADIUS`; a different size is a design decision listed as an
  explicit exception in the roster's identity tests (ADR 0008). The Titan is the one exception: it
  grows through `radiusOf` (ADR 0034).
- Sim tests share helpers from `src/sim/test-support.ts` (`run`, `withBalls`, `deepFreeze`) and
  its fixture balls `red` and `blue`, which have no abilities and fixed stats, so core tests don't
  change when real balls are rebalanced. Test-only balls with hooks are declared in the test.
- Balance targets (`pnpm balance`, ADR 0045 group 4): every ball wins 45-55% overall, no matchup
  worse than 22/78, draws under 5%, median match 12-30 s, win rates move at most 15 points
  (warning) or 20 points (failure) for ±5% max health, since the measurement has ±2-3 points of
  noise, Vampire heals at least 25% of max health per match, comebacks 10-20% (the ball once behind
  by a quarter of its health wins), every pair inside its counter-map floor and every ball's shape
  (`scripts/counter-map.ts`). A counter (▲▼) targets 65-72% with a floor of 62-78%; even targets
  45-55% with no side above 62% (or under 22%), and an even side over 58% is the grey zone (counted and warned,
  never failed). A pair between target and floor is a WARN; within 2 points outside the floor
  passes as NEAR; further out is a MISS. The shape: every ball 2-4 counters each way, the counts
  within 1, except the even picks (`EVEN_PICKS`, exactly their listed counters) and the known gaps
  (`SHAPE_EXCEPTIONS`, by name: gaps for future balls, `docs/vision.md`). A full run judges the
  measured shape, CI's reduced run the map's. Re-check after any stat or ability change.
- Counters come from mechanics (ADR 0010): a new ball adds an entry for every pair (in the
  `src/sim/counter-map-*.ts` data file for its batch; the bands are checked in
  `scripts/counter-map.ts`), and each
  favoured or unfavoured matchup needs a mechanical reason in that entry. Stats tune how strong a
  counter is, never whether it exists. Measure what a ball's mechanic moves before choosing its
  counters; a planned counter that never appears is replaced, not forced with stats (ADR 0015). The Brawler and Magnet are the even picks: the
  Brawler beats nobody and loses only to Thorns (ADR 0013, 0049), the Magnet loses only to Thorns.
  Ball identity rules are pinned in `src/sim/balls/identity.test.ts` (read from the definitions)
  and `ability-share.slow.test.ts` (measured); breaking one is a design decision, not a tuning
  step. Longer fights make matchups steeper (ADR 0004).
- No interaction rules (ADR 0045): every ability does one clear thing that works the same on any
  ball (a kind of hit, a kind of movement), and no rule exists only where two specific abilities
  meet. The three rules of ADR 0016/0028 (heal cut, aim held, rage numbed), their statuses and the
  spark that marked them are gone. A counter comes from what the balls already do and must be
  guessable by watching. The roster redesign (`docs/roster-redesign.md`) shipped in four groups.
  A pair only counts as a counter if it wins 62% or more (ADR 0045, group 4): the map is labelled
  from the full run, and a designed counter that measures less is marked even (no ▲▼, an even
  reason).
- The pass-through property test in `src/sim/balls/pass-through.slow.test.ts` (closing speed below 0.6 of the
  `(rA + rB) / DT` detection limit) must not be loosened again. If a ball pushes past it, implement
  swept ball-to-ball collision instead.
- A behaviour test should be shown to fail with the behaviour disabled before it is trusted.
- World coordinates are in world units (`ARENA_SIZE` = 1000), never pixels. The renderer maps
  world units to the screen.
- Colours and sizes for the renderer come from `src/render/theme.ts`, not inline literals.
- **Phone first, then a deliberate layout for larger screens** (ADR 0020, 0031). Design every
  screen for a phone (about 375 px wide) first: one clear job per screen and as few controls as
  possible. Then give each screen a deliberate layout for larger screens. "Adapting" means
  re-arranging to use the space (columns side by side, a list beside its detail), never the
  phone layout centred in a wide page. Desktop rules go in the one desktop query
  (`(min-width: 64rem) and (min-aspect-ratio: 5/4)`, next to the component's phone rules) and
  never change the phone. Prefer the page scrolling to inner scroll boxes, which an overlay
  scrollbar draws over, unless an inner scroll area has a clear purpose. Keep sensible maximum
  widths (`--sheet-width`). Check every screen at 375×812 and at 1280×800, 1440×900 and
  1920×1080 before calling it done. The arena shows only when something is fighting; setup and
  reading screens, and a series between rounds, take the whole phone screen (ADR 0020, 0025),
  and on a desktop setup and reading screens show no arena at all (ADR 0031). Setup and reading
  screens start at the top, so every header sits in the same place; only the panel beside a match
  centres (ADR 0039).
- **The phone arena is the screen** (ADR 0039). On a phone, whenever the court shows it is as wide
  as the page allows, and mid-fight the court, both health bars and speed fit on one screen with
  no scroll, also at 390 × 664 (Safari with its toolbars). Anything opened mid-fight (the legend,
  the full track) scrolls the page; it never squeezes the court. Measure a new part under the
  court against `phone-arena-flow.ts` before adding it. Respect the safe areas.
- **No dead ends** (ADR 0027). Every screen state offers at least one control that moves the
  player forward (or the result screen's buttons). A series screen renders only the actions of
  `seriesScreenOf`, and `no-dead-end.test.ts` walks every format, outcome order and pick, live and
  from a link; a new state or format must pass it.
- **Teach in the arena, once** (ADR 0036). What a newcomer needs is shown at the moment it happens
  and read from sim events (a ball's `ability.shownBy`, a damage event's `via`), never guessed from
  event order; tips show once per device (`src/app/tips.ts`) and are turned off in settings.
  A new ball with an ability to point at names it and the event that shows it. A ball's manual page
  shows a folded "How it works" when its definition has `howItWorks` (ADR 0049): the real rules and
  numbers, written from the constants the ability uses so they never go stale.
- **Show less by default** (ADR 0025). Information appears when the player wants it (on a tap, a
  `<details>` expander or a "more" link); anything shown is concise; visuals and symbols (ball
  icons, vs layouts, highlights, ▲ ▼ =) beat sentences wherever they're clear. Any symbol must be
  understandable without explanation or explained once in the symbol legend (`symbol-legend.ts`,
  the `?` in a screen's header), and always has words in its accessible name. Marks come from
  `src/ui/balls/marks.ts`; what each symbol means is in `src/ui/symbols.ts`, read by both the
  legend and the hover/focus tooltip. Name every symbol on screen with `markSymbol` so the tooltip
  can explain it. A matchup mark names both balls and who has the edge (`matchupTip`); a mark a
  phone player must read is its own 44 px tap target beside the control, never inside it, and
  nothing relies on press-and-hold (ADR 0037).
- **One look per screen state** (ADR 0038). A part that several screens show is one component
  used by all of them: "How it was won" (`match-story.ts`), the pick banner and rows, the series
  bar (`?` and what is played), the pairing (`balls/pairing.ts`) and the ready card, which
  always sits centred on the court. `one-of-each.test.ts` fails on a second copy, and
  `src/flows/consistency-flow.ts` checks at 375, 390 x 664, 1280 and 1920 wide that every legend
  opens without losing its `?` and closes with the `?`, its Close and Escape. One look means the
  rendered look too: no context rule restyles a shared part on one screen (`look-checks.ts`
  compares computed styles, ADR 0044). The legend and settings are one info panel
  (`info-panel.css`, `.panel-close`). Escape only ever closes things; it never starts or picks.
- **One tap to the main mode** (ADR 0046). Home's Play goes straight to Reveal's lineup against
  the remembered bot level; the lineup step shows what it is for and the level, changed in place
  (no history step). Every other way to play is a card on Other modes (`OTHER_MODE_SECTIONS` in
  `src/app/modes.ts`, sections of modes); a new mode is data there, not a new screen. The series
  section opens with a remembered Best of 3 / Best of 5 choice (ADR 0048); a series' length is
  `SeriesSetup.bestOf` (absent is 3, `mode=bo5` in a link), never a constant. A lineup's in-app Back without history goes to its parent (`lineupParentOf`): home for
  Reveal, Other modes otherwise. `?mode=bo3` links still open the rules step. A lineup URL's
  format is the URL's (none is Blind). While a series is held (`held()`: undecided, off screen,
  after a Back or a reload) home's Play is Resume series with its format and score, and New series
  forgets it (`forget()`).
- **Settings** (ADR 0040) is one menu (`settings-menu.ts`) behind a gear at the top right of every
  screen, just before the `?` where there is one; exactly one gear per screen. It floats by its
  gear inside the visible screen and never moves the layout; the gear, Close, Escape and a tap
  outside close it, with focus back on the gear. It keeps off the court (beside it on a desktop,
  over the panel on a phone, compact on a short phone); only when nothing keeps it off does it
  cover the court, and then the arena holds the match until it closes (render side, ADR 0044).
  It holds only real per-device choices (speed, ability hints, what-to-watch cards); the
  consistency flow checks it from every screen.
- **Back** follows one rule for every move (ADR 0025, `src/app/history-rules.ts`): move between
  screens with `navigation.go`, never by choosing push or replace. A move on the same screen key
  replaces the entry, going to the screen this entry came from goes back to it, a series is one
  entry. A new screen gets a key in `screenKeyOf` and a flow in `history-rules.test.ts`. Leaving
  an undecided series holds it to resume; never drop it on Back.
- **A series survives a reload** (ADR 0042). The series controller saves the session after every
  change (`src/app/series-save.ts`, in `localStorage`, never the URL): the setup with its picks so
  far (what `verifySeries` checks), the plays recorded and whether the last result is on screen.
  `restoreSeries` replays it with the same session functions and trusts it only if `verifySeries`
  accepts the whole series; anything else is dropped and the page starts as usual. A new session
  change in the controller goes through `keep` so it is saved; a deliberate exit (Leave series,
  New series) clears it, a Back holds it. A fight under way restarts from its Fight! moment.
  Browser flows that reload use a frame (`src/flows/reload-support.ts`); every browser test file
  starts with no saved series (`src/flows/browser-setup.ts`).
- Page colours, sizes and type come from roles in `src/styles/tokens.css`, never palette names or
  literals. The look is Sticker Pop (ADR 0032): one self-hosted family (Bricolage Grotesque, CSP
  `font-src 'self'`), calm platform screens (flat fills, the pink second accent used sparingly) and
  the energy in the arena and match moments (the court, health pills, the Winner sticker). Keep
  that split; every ball must keep 3:1 against the floor, and text in a ball's colour goes
  through `readableOn` for 4.5:1 on its background (`arena-contrast.test.ts`). A component's stylesheet sits next to it and is listed in `src/style.css` in cascade
  order; create the file before adding its `@import` (the dev server caches a missing import).
- Ball and matchup text in the UI is read from the definitions and the counter map
  (`src/ui/balls/matchups.ts`); it says "favoured", never a measured win rate.
- Tests sit next to the code as `*.test.ts`.
- Keep files under 300 lines (ESLint `max-lines`); split by responsibility before that.
- Conventional Commits (`feat(sim): ...`, `chore: ...`), small and single-purpose. The commit body
  explains why.
- Record significant decisions as numbered ADRs in `docs/decisions/`.
- Stop any dev server or other background process you started before finishing a task. Check the
  port is actually free afterwards: stopping the `pnpm dev` wrapper can leave the `vite` child
  process running and holding the port.

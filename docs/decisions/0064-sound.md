# 0064: Sound, made in code, with a voice for every ball

- Status: Accepted (2026-11-18), with the owner's decisions below. Prototyped on `proto/sound`
  (draft PR #92, closed unmerged; `docs/sound-proposal/README.md` there), then built on `main` in
  PR #95.
- Date: 2026-11-18
- Amended by: ADR 0070 (every control sounds: a soft press, Back steps down; key moments keep their tap); ADR 0075 (eight sounds for the Balloon, Banshee and Kraken); ADR 0077 (five sounds for the Mirage and the Jouster)
- Amends: ADR 0040 (settings: a Sound row beside Speed)
- Builds on: ADR 0007 (presentation time: sound reads the arena's ticks the way effects do), ADR
  0053 and 0054 (live fights and their server-timed countdown), ADR 0061 (the coin toss), ADR 0063
  (Low Power Mode: nothing may lengthen a frame)

## Context

The game was silent. Sound is a large part of a game feeling finished, and in this one it can do a
job the picture does less well: say what kind of hit just landed, so a counter is heard working
(the Thorns' spikes biting back, the Chrono rewinding, the Bloom regrowing). A prototype voiced the
shared sounds and four balls; the owner listened on an iPhone, liked every sound and asked for the
whole roster in the same style.

## Decision

### Made in code, not from files

Every sound is a few Web Audio oscillators and a burst of filtered noise, made when it plays
(`src/sound/synth.ts`). No files, no library: the whole of sound is 23.9 kB of script (7.5 kB
gzipped), it is ready on the first tap, it needs no change to the CSP, and one set of envelopes
and one scale keeps 25 balls sounding like one game. Recorded files (CC0) would be realer and
about 150-400 kB, with a licence to record for each.

**The style (Sticker Pop in sound):** sines and soft triangles for the body, a click or a breath of
filtered noise for the edge, pitches from C major pentatonic (`voices/scale.ts`) so any two sounds
that meet agree; square and sawtooth waves always through a low-pass; nothing but the series result
lasts a second.

### A voice for every ball

Each ball's sounds (`src/sound/ball-sounds.ts`) say what its ability does, and the counters it
meets are heard in them:

| Kind (voices file) | Ball and its sounds                                                                                                                                                                                                                                                                                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| From range (shots) | Archer: an airy fwip, a woody tock. Boomerang: a whirr, a hollow thok going out and a step higher coming back, a soft catch. Sniper: two warning beeps on lock-on, a dry crack, a punch with a metal pank. Spartan: a clang as the shield plants, a ricochet ting off it, a low spear whoosh, a woody crack. Necromancer: bones rattling up, a double clack bite, bones scattering |
| Through the court  | Bomber: a plonk with a fuse hiss, a deep rolling boom. Storm: a crackle rising under the warning, a crack and rolling thunder (only the crack on a miss). Quake: a rumble leaving the wall, gravel when it catches a ball. Inferno: a hiss and pop when it burns. Spider: a sticky thwip as a web is spun, a sagging twang when it catches                                         |
| In the body        | Berserker: a growl as rage builds, a roar as it lets it out. Speedster: a whip-crack, its zip longer with more speed. Titan: a slow stretch at each of four growth steps. Thorns: a metallic shing. Ghost: a shimmer as it phases, a hollow whoo through a ball. Magnet: a rising hum, stronger when a shot sets it off                                                            |
| Health and time    | Frost: glassy crystals. Venom: a bubbling glug, then small drips. Vampire: a dark sip. Bloom: a chime opening as it regrows, pinched shut by a hit. Chrono: a sound played backwards. Battery: a rising charge, a zap into a boom. Hex: two wobbling notes, a hollow whump. Slime: a splat and two bloops gliding apart                                                            |

The Brawler has no ability, so it says only the shared bump; every ball shares the bump, a hit from
anything without a voice, and the knockout. When a ball's ability is the bump (a Battery's
release, a Berserker's rage, a Speedster's boosted hit, a Ghost passing through) its sound takes
the bump's place; otherwise it plays beside it.

**Read, never told:** cues come from the tick's events (`cues.ts`) and, where no event marks a
moment, from a ball's ability state between the two worlds (`state-cues.ts`: a curse landing, a
phase starting, a pull, a lock-on, a shield, a web, a growth step, rage, the Bloom opening or
shutting). Pure, render-side, like the effects (ADR 0007): the sim never knows sound exists, no
ruleset bump, the golden results unchanged.

### The owner's decisions (2026-11-18)

- **On by default, at 70%.** Nothing plays before the first tap (browsers forbid it), and an iPhone
  follows its silent switch.
- **Buttons tap only at key moments:** Play, Send challenge, Accept challenge, Start rematch and
  Rematch (`data-sound="tap"`). A pick has its own lock sound; every other button is quiet.
- **Wall bounces stay silent** (constant, and they would tire).
- **No music.** Worth revisiting as a quiet, optional menu loop.
- **The home demo is silent.**

### Kept calm, never late, never loud

- **A gate on real time** (`gate.ts`, `rules.ts`): every sound has a shortest gap and gets quieter
  in a run (to 40%), and the mix holds at most 4 sounds per 120 ms, strongest first. Streams that
  come several times a second (burns, poison drips, webs, rage, shockwaves) are spaced 220 ms
  apart and softened. Measured over every pair of the roster (`scripts/sound-density.ts`, 5 seeds):
  at 1x a median 1.2 sounds a second (p90 2.1), busiest second 10 (Quake vs Boomerang); at 2x a
  median 2.3, busiest second 13.
- **A limiter** after the volume: the loudest eight sounds of the roster at once stay under full
  scale (`voices.browser.test.ts`; the gate never lets more than four through).
- **Off the frame:** a fight's sounds are chosen in its frame (pure reading) and made by a timer
  just after it, so building audio nodes never lengthens a frame. With the CPU slowed 6x and frames
  held to 30 a second, frame work is the same with sound on (median 2.2-2.7 ms either way).
- **Never a burst:** a live fight caught up headlessly (`showAt`) is silent, so a reconnect never
  plays the hits it skipped (`catch-up.browser.test.ts`, which fails when the catch-up is heard).
- **Live:** the countdown and Fight! play from the same timers that change the ready card, set for
  the server's moment (ADR 0054); the coin toss is heard only from its start. Two phones with sound
  on stay a median 1.1 world units apart (`live-sync.online.test.ts` now counts their sound).
- **iPhone:** the AudioContext is made on the first tap, `navigator.audioSession.type = 'ambient'`
  (it obeys the silent switch and lets the player's music play on), it is suspended while the page
  is hidden, and one left interrupted is resumed, or made again, on the next tap.

### Where it shows

- **Settings:** one Sound row beside Speed, a volume slider and a switch (amends ADR 0040). The
  menu had 2 px to spare at 390 x 664; the taller menu found that it could cover its own gear, fixed
  on its own first (PR #93).
- **Hear it** on each ball's manual page plays its sounds in turn, while sound is on.
- **The sound board** (`/sounds.html`) is dev only, like the style guide: Vite builds `index.html`
  alone. Every sound, each ball's in turn, and the busiest fights played as sound alone at 1x and 2x.

## Tests

- `ball-sounds.slow.test.ts`: across every pair, every ball's own sounds are heard in its matches,
  and no match makes a third ball's sound.
- `voices-distinct.browser.test.ts`: every ball's sounds rendered offline and compared as coarse
  spectrograms; no two balls' are alike (closest 0.89 against a limit of 0.9; the first draft had
  Quake and Spear hit at 0.96, Arrow and Boomerang at 0.95, Bomb and Thunder at 0.94, and those were
  reworked).
- `voices.browser.test.ts`: every sound heard, under full scale and short; the busiest moment.
- `taps.browser.test.ts`, `cues.test.ts`, `gate.test.ts`, `sound-settings.test.ts`.
- The audio tests skip in Playwright's WebKit on Linux and Windows, which is built without Web
  Audio; Chromium and Firefox render them. The two that need audio running (taps, catch-up) also
  skip on a machine with no audio output, such as Firefox on CI; Chromium covers them there.

## Consequences

- The game has a voice, and a counter can be heard working. The bundle is 7.5 kB gzipped larger.
- A new ball needs its sounds: an entry in `cue-names.ts`, a voice, a cue rule, a gate rule and its
  row in `ball-sounds.ts`; the tests fail until each is heard in a real fight and stays unlike the
  rest.
- Not verified here: how it sounds on a real phone speaker over a Best of 5. The board's busiest
  fights are there to judge it by ear.

## Addendum (2026-11-27): the audit's top three

From the sound audit (`proposals-sound/PROPOSAL.md`, findings 3.1 to 3.3):

- **The knockout is always heard.** A gate rule may say `always` (`gate.ts`): it skips the cap of 4
  per 120 ms but still counts toward it. The knockout and the end bell have it, so a busy last
  moment (Quake against Boomerang at 2x) never ends the match in silence. "At most 4 per window"
  now reads "at most 4, except a sound that must be heard".
- **Every end has a sound.** A time-limit end has no knockout, and a draw no winner: `endBell`, a
  shared cue on `matchEnded` when the reason is the time limit or the result a draw. Two soft sine
  bell strikes, G5 then C6, each with a quiet octave, about 0.6 s: on the scale, under a second.
  A knockout win keeps its pop alone. Silent where every fight sound is (the demo, a finished
  match, a catch-up).
- **A key moment's `tap` follows ADR 0070.** It goes through the menu gate (its own `MENU` rule)
  on a trusted click only, like every other control, so a click passed on to Accept or a double tap
  on Play is one sound. A quick run of taps on key moments now gets quieter like the rest.

Tests: `gate.test.ts` (a full window still plays an `always` kind, and the next ordinary sound is
capped), `cues.test.ts` (a time-limit match rings once and pops never; a knockout draw pops twice
and rings; a knockout win never rings), `rules.test.ts` (`tap` has the menu rule),
`taps.browser.test.ts` (a click passed on to a `tap` control and a double tap on Play are one sound
each). Each failed with its fix taken out. The voice tests cover the bell's length and level.

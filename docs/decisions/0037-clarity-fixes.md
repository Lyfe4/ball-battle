# 0037: Clarity fixes: whose edge a mark shows, sentence prompts, a ready moment, a story led by its result

- Status: Accepted
- Date: 2026-11-07
- Amends: ADR 0025 (§4 the pick banner and rows), ADR 0030 (§4 tooltips), ADR 0035 (§4 the rows,
  §5 touch: press-and-hold is gone), ADR 0036 (§4 the versus card is replaced, §5 the story)

## Context

Five things from playing, on a phone and a desktop:

- **Marks didn't say whose edge they showed.** On a pick row the mark sat on the bot's ball icon,
  and its tooltip said "Strong vs: favoured, wins it more often". It read as the bot's edge as
  easily as the player's.
- **Prompts read like labels:** "Your pick: answer [ball]".
- **The versus card was unreadable.** It held the intro 1.3 s longer, too short to read the title.
- **Phones couldn't reach a tooltip.** On a real iPhone a tap on a pick row picks, and press and hold
  (ADR 0035) opened the phone's own text selection and copy menu instead.
- **"How it was won" was confusing.** It repeated itself ("Chrono dealt 85 / Hits 85"). "Titan's
  hits −20" didn't say who was hit or why it mattered. It never stated the result. Its moments
  followed no visible rule. It sat under the round 2 pick, competing with the choice.

Presentation only: `src/sim`, URLs and `RULESET_VERSION` are unchanged.

## Decision

### 1. Pick rows as a type chart, the mark in the player's own row

- **The bot's balls appear once, as column heads** ("vs the bot's", the ball being answered
  ringed). Each row is one of the player's balls, and its cells are the player's marks against
  each column. The mark sits in the player's own row, so it reads as the player's edge.
- **The key says whose edge each mark is:** "▲ you're favoured · = even · ▼ bot's favoured".
- **Every matchup tooltip names both balls and who has the edge** (`matchupTip`), then the counter
  map's one-line reason:
  - in a series: "Your Chrono vs the bot's Storm: you're favoured";
  - on Free play tiles and slots, and in the matchup chart (row against column): "Speedster vs
    Storm: Storm is favoured";
  - a mirror: "a mirror, even".
- **The legend says what a mark means without a screen's context:** "Favoured: this ball tends to
  win the matchup (on a pick row, your ball against the bot's)".

### 2. Prompts as sentences

| Kind              | Prompt                                            |
| ----------------- | ------------------------------------------------- |
| Answer            | The bot plays Venom [icon]. Pick your answer.     |
| Show first        | You show first. Pick a ball; the bot answers.     |
| Showdown's opener | Pick your opener. The bot picks at the same time. |

On a phone the first sentence is bold and the second sits under it, muted. On a desktop they
share one line. The live region uses the same words.

### 3. Marks are their own tap targets; no press-and-hold

- **Each row is a container, not one button.** A pick button is stretched over the whole row, and
  the marks sit beside it as their own 44 px buttons (a 30 px disc drawn inside). A tap or click on
  a mark shows its tooltip (for 4 s) and never picks. A tap anywhere else on the row picks.
  - The mark buttons are `tabindex="-1"` and `aria-hidden`. The pick button's name already says
    every lean in words, and keyboard focus on it lists them all (`data-symbol-scope`).
- **Press-and-hold is removed everywhere.** No screen relies on it any more:
  - a pick row's marks are tapped;
  - a grid tile picks, and its slot badge and the verdict then explain the pair;
  - the matchup chart's cell opens its detail.
- **No selection or copy menu.** Rows, tiles, slots, chart cells and marks set
  `user-select: none`, `-webkit-touch-callout: none` and `touch-action: manipulation`.
  `selectstart` and `contextmenu` are prevented on them. iOS showed its menu over button text that
  ADR 0035's single `button:has([data-symbol])` rule didn't stop.
- **Tested with real taps.** A new test project, `browsers-touch`, runs in Chromium, Firefox and
  WebKit with touch on at 375 × 812, with a `tap` command (Playwright's own tap: touch events, from
  which the browser makes the pointer events and the click). It checks:
  - a tap on a mark explains it and leaves the step unchanged;
  - a tap on the row picks;
  - the 44 px target;
  - selection and the menu are prevented.

  It fails when a tap on the row container picks, as the old single-button row did.

### 4. A ready moment before a fight (replaces the versus card)

Once the balls are chosen, the arena shows both balls still, exactly where the match starts. A
sticker card shows the pairing and a pink **Fight!** button.

- **Exactly tick 0.** The match is held in presentation time (`heldFrameMs`, ADR 0007). The intro's
  pop-in plays, then time stops with the intro's last beat left, so no tick runs. After Fight! the
  same ticks run as they would have.
  - A unit test holds a match for 600 frames: no tick runs, and the playback world is the opening
    world itself (the same object). Released, its first tick equals the sim's own.
  - A browser test checks the canvas doesn't change while held.
- **The card's words, for a pairing new to this device:** both balls, "▲ Venom is favoured" (or
  "Even matchup", "Mirror match"), and "What to watch:" with the counter map's reason. It has time
  to be read, and it can be turned off from the card ("Don't show these again") or with the tips.
- **When a match waits (recommendation, with the requested change for Best of 3):**

  | Where     | Card due (new pairing, tips and card on) | Otherwise                             |
  | --------- | ---------------------------------------- | ------------------------------------- |
  | Best of 3 | Card and Fight!                          | The pairing and Fight! (smaller)      |
  | Free play | Card and Fight!                          | No wait: starts after the 1.1 s intro |
  | Home demo | Never                                    | Never                                 |
  - Best of 3 always waits, a deliberate "ready, fight" beat between rounds.
  - In Free play, Fight! exists only to give reading time. Without the card it would be a tap
    before every match of a run, so the match starts by itself.
  - A card per new pairing, rather than ADR 0036's first three matches, because the reason is per
    pairing. It shows exactly when it says something new, and a pair played again never asks
    again. Seen pairs are kept in `ballbattle.readySeen`, in either order. If storage throws, a
    card shows once per page load.

- **Where the card sits.**
  - On a phone it hangs from the arena's bottom rim, over the series bar and track (not needed at
    that moment). A readable card covers most of a 343 px court wherever it sits.
  - With the panel beside the arena (layout.css's wide layout) the court is tall. The card covers
    about a third of it and sits over the court, in the band (top, middle, bottom) that its starting
    balls leave clearest, measured from its real height (`placeFor`).
- **Accessible.** Fight! takes focus when the round starts. Enter and Space start the match, and
  so does Escape (the moment is never a trap). Afterwards focus moves to the arena. The card's
  words are read by screen readers. The pop and Fight!'s glow only run when motion is welcome; the glow changes brightness, never size, so Fight! stays a still target (a growing button never settled for a tap).

### 5. "How it was won": the result first, moments by a stated rule

- **The summary is the result**, in one plain line that reads closed: "Titan knocked out Venom at
  0:20", "Time up: Titan won with more health left", "Time up: a draw".
- **Names say whose ball is whose.**
  - A series round says "your" and "the bot's": "The bot's Berserker knocked out your Titan at
    0:16".
  - A Free play mirror says "Titan A" and "Titan B", as the HUD's slots do.
- **The breakdown adds information or stays short.** Each ball keeps one bar (who out-damaged whom).
  The sources are listed only when a ball has more than one, or healed. Otherwise the bar says
  "all hits" (or "all Poison").
- **Each key moment is a sentence saying what happened, and to whom.** For example: "Your Titan hit
  the bot's Berserker for 21, the round's biggest hit." "Shock cut Vampire's healing." "Chrono
  rewound its own knockout."
- **The rule for key moments.** At most four, shown in time order, kept in this priority:
  1. **The finish**, always: the knockout, or time running out with the leader named.
  2. **The comeback**: when the winner pulled ahead in health share for good, shown only if the
     loser was ahead at some point before. A lead taken with the final blow is left to the finish.
  3. **Each counter rule or rewind**, the first time it acted. These are the designed reasons a
     matchup leans (ADR 0016, 0028, 0034).
  4. **The round's biggest single hit**, if it took 20 or more.

  This replaces "the earliest turns of the fight fill the rest", which is why early 0:01 events
  sometimes showed and sometimes didn't.

- **Out of the way on decision screens.** Between rounds it is the last thing in the panel, a quiet
  line with no card of its own ("Round 1: Your Titan knocked out the bot's Ghost at 0:19 · How it
  was won ›"), under the pick and its key. It is never opened for the player.
- **Cost.** The story is worked out when the result line is first needed (the round's end), by
  replaying the match headlessly, rather than when opened. Replaying one match takes a few
  milliseconds, and nothing is computed while a round is fought.

## Consequences

- Positive: a mark reads the same way on every screen, and its tooltip can't be misread. On a phone
  it is one tap away and never picks by accident.
- Positive: the player reads "what to watch" while the balls stand still, for as long as they like.
  Best of 3 gets a clear beat before each round.
- Positive: "How it was won" answers "who won and how" closed, and its moments follow one rule that
  can be checked.
- Negative: Best of 3 costs one more tap per round, by design. Free play costs one only for a new
  pairing.
- Negative: on a phone the ready card covers the series track for that moment.
- Negative: a pick row's marks are no longer drawn on the bot's balls. Reading a column means
  glancing up to its head (at most three columns).

Screenshots in `docs/images/clarity/`, `before/` (from the app before this change) and `after/`,
each at phone (375 × 812) and desktop (1280 × 800) width:

- `answer-tooltip`: Reveal's round 1, a mark's tooltip open;
- `ready-card` and `ready-plain`: a round waiting on Fight!, with and without the card;
- `round2-pick` and `round2-story-open`: round 2's pick with the story as a quiet line, then open;
- `free-play`: the slots and the grid's key ("▲ strong · ▼ weak vs").

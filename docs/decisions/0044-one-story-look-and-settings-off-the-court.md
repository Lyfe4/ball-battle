# 0044: One look for "How it was won", and settings that keep off the court

- Status: Accepted
- Date: 2026-11-08
- Amends: ADR 0037 (§5: the story is no longer a quiet line between rounds), ADR 0038 (§1 the
  legend's look, §5 the consistency flow also compares rendered looks), ADR 0040 (§ one panel:
  where it is placed, a compact form, the match waits under it, and a tap outside returns focus)

## Context

Playtesting on an iPhone in Safari (about 390 × 664 visible) found two problems.

- **"How it was won" had two looks.** At a Best of 3 result it was a card (surface fill, rounded)
  with a bright headline; between rounds (under the round 2 pick rows) it was plain muted text with
  no card. One component (`match-story.ts`, ADR 0038) rendered both: a context rule in
  `match-story.css` (`.series[data-phase='between'] .match-story`) took the card away so the
  story would not compete with the pick (ADR 0037). The consistency flow compared structure only,
  so it could not see it.
- **Settings covered the court mid-fight.** ADR 0040 placed the panel under its gear, or over it
  when there was no room below. Mid-fight on a phone the gear sits in the score line under the
  court, so the panel opened upward over almost the whole court, with about 210 px free under the
  gear. On a desktop the panel (20rem) is wider than the side panel (16rem), so right-aligned to
  its gear it reached about 70 px over the court's right edge.

The `?` legend (inline, ADR 0038) and the settings panel also looked different: surface fill,
the small radius and small padding for one; raised fill, slab, the large radius for the other.

Presentation only: `src/sim`, the ruleset, links and the story's rule are unchanged.

## Decision

### 1. "How it was won" looks the same everywhere

The between-rounds override is gone: between rounds, at a series result and at a Free play result,
on a phone and a desktop, the story is the same card with the same bright headline. The pick stays
the screen's focus because it comes first and is the only thing with the pink selection; the story
is closed by default and sits last.

**Test** (`src/flows/look-checks.ts`, run by the consistency flow at 375 × 812, 390 × 664,
1280 × 800 and 1920 × 1080): every visible story's computed card (fill, radius, padding, the
summary's padding and height, and the colour, size, weight and family of its label, result and
"How it was won") must equal the look of a copy placed straight in the page, outside any screen.
Any context rule that restyles it, on any screen or size, fails. Shown failing before the change
after every round at 390 × 664 and 1280 × 800.

### 2. Settings keep off the court

`placeMenu` (`settings-place.ts`, pure and tested) is given the drawn court when one shows
(`arena.court`: none behind a setup screen, or between rounds on a phone) and tries, in order:

1. **Under its gear**, its right edge on the gear's, then **over its gear**: as before.
2. **Under or over the court**, over the health bars and speed rather than the fight.
3. **Beside a desktop court** it keeps to the gear's side: `menuWidth` narrows it to the room
   between the court and the screen's edge (down to 240 px), so it sits over the side panel.

A place counts only if it is inside the visible screen (`visualViewport`, safe areas, 16 px edges)
and covers neither the court nor its own gear (which closes it). If no place is clear at its own
size, the menu tries its **compact form**: the title shares its row with speed, and the "Speed" and
"Tips in the arena" captions are left to screen readers (the controls keep their names and 44 px
targets). Its height is capped to the visible screen, so it scrolls inside itself rather than ever
going off screen or under Safari's toolbar.

### 3. When it can't keep off the court, the match waits

If even the compact form has no clear place, the menu opens at its own size by its gear (as in ADR 0040) and says "The match waits while this is open." The arena holds the match while
`settingsCoverCourt()` is true, through the same pause as a covering dialog (ADR 0011): no
presentation time passes, so no tick runs, and it carries on exactly where it stopped on close.
`src/sim` is untouched and the fight is the same fight.

Measured with the real page (Chromium):

| Screen (visible size)                 | Mid-fight in a series            | Mid-fight in Free play           |
| ------------------------------------- | -------------------------------- | -------------------------------- |
| 375 × 812                             | under its gear, full size        | under its gear, full size        |
| 390 × 844 (iPhone, no toolbars)       | under its gear, full size        | under its gear, full size        |
| 390 × 664 (that iPhone in Safari)     | under its gear, compact          | under its gear, compact          |
| 375 × 635 (a 375-wide iPhone, Safari) | **covers, the match waits**      | **covers, the match waits**      |
| 1280 × 800, 1440 × 900, 1920 × 1080   | beside the court, over the panel | beside the court, over the panel |

So the match waits only on phones with less than about 210 px between the gear and the screen's
bottom edge (Safari with its toolbars on a 375-wide phone, an iPhone SE, a phone turned sideways),
and in those cases only while settings are open. Between rounds, at results and on setup screens
no court is fighting, so nothing waits.

### 4. A tap outside returns focus

A tap or click outside on nothing focusable now closes the menu and returns focus to the gear, as
Close and Escape do; its mousedown is kept from moving focus to the page. A tap on a control
outside does what it does and takes focus.

### 5. The legend and settings share one look

One stylesheet, `src/ui/info-panel.css`: a raised fill on one slab, the large radius, the gap as
padding, the small type, and the same Close link (`.panel-close`, a quiet link with a full tap
target at the panel's end, on the right). The legend stays inline (ADR 0038); settings float. The
settings title keeps the display face, which the legend has no need for.

**Test**: the consistency flow notes every open legend and settings panel and fails unless all
share fill, radius, padding, shadow, type and the Close link's look and place. Shown failing before
the change at 390 × 664 and 1280 × 800.

## Tests

- **`src/flows/settings-checks.ts`** (the consistency flow's settings check), from every screen
  with a gear (home, the series rules and lineup, the manual, round 1's pick, each round mid-fight,
  between rounds, the result, Free play's setup, fight and result) at 375 × 812, 390 × 664 (new
  `consistency.safari.browser.test.ts`), 1280 × 800 and 1920 × 1080, in three engines: one gear;
  the menu opens fully inside the visible screen; it closes by the gear, Close, Escape and a tap
  outside (a real tap on touch, through a new `pressAt` command), with focus back on the gear.
  With a court on screen it never covers it on a desktop, and mid-fight either it is clear of the
  court and the court keeps moving, or it covers it and the court stands still, then moves again
  after closing. Shown failing before the change (tap outside left focus on the page; the desktop
  panel covered the court; at 390 × 664 the fight ran under it).
- **`settings-pause.safari.browser.test.ts`**: the menu made too tall for any clear place covers
  the court, shows the note, and the court stands still until it closes. Shown failing with the
  pause disabled.
- **`settings-place.test.ts`**: each place in order, the gear never covered, the desktop width,
  and the height cap.

## Consequences

- Positive: the story is one design in every place, and a test now sees looks, not only parts.
- Positive: opening settings mid-fight on a phone leaves the court in view where there is room,
  and never lets the player miss anything where there isn't.
- Negative: mid-fight on a phone the open menu can sit some way from its gear (over the health
  bars), and the compact form drops two captions on short screens.
- Negative: the consistency flow runs at one more size (three engines) in CI.

Screenshots: `docs/images/settings-place/` (`before/`, `after/`) at 390 × 664 (phone) and
1280 × 800 (desktop): settings mid-fight, the story between rounds and at the result, the legend
with settings open; and `after/phone-short-paused.png` at 375 × 635, where the match waits.

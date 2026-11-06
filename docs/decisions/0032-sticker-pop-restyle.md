# 0032: The Sticker Pop restyle: a calm platform, a playful arena

- Status: Accepted
- Date: 2026-11-06
- Amends: ADR 0020 (§6 fonts and the CSP), ADR 0031 (the look only; no layout changes)

## Context

The UI was a functional dark slate: the system font, one blue accent and a flat `#161a23` arena
with a slate border. It worked, but had no character, and the match (the part people watch) looked
the same as the menus. The brief:

- **Platform screens** (home, setup, the manual, notices) should look like a high-end modern app:
  sleek and confident, never tacky.
- **The arena and match moments** (the court, the HUD, the result) should be fun and gamified.
- The two must feel like one product.
- Ball designs stay exactly as they are and must still stand out.

Three directions were mocked up with the game's own renderer playing real matches (Obsidian,
Sticker Pop, Prime Time). Sticker Pop was chosen, with a guardrail: keep it restrained on the
platform screens and put the energy in the arena.

Presentation only: `src/sim`, URLs, Back, layouts and `RULESET_VERSION` are unchanged.

## Decision

### 1. One family, self-hosted

- **The font.** Bricolage Grotesque (OFL), the variable weight axis, from
  `@fontsource-variable/bricolage-grotesque`. Vite emits the woff2 files into `/assets`, and the
  browser loads only the subsets a page uses: the Latin file, 41 kB.
- **The CSP.** `font-src 'self'` is added in `scripts/security-headers.ts` and `netlify.toml`.
  Checked on `pnpm preview` in Chromium, Firefox and WebKit: no CSP errors.
- **Headings** use the family's 800 weight (`--font-weight-display`), with no second display face.
- **Glyphs the family lacks** (▲ ▼ ✕ ×) fall back to the system font, as they did before. The Back
  chevron ‹ reads as a bracket in this family, so it uses `--font-family-symbol`.

### 2. Tokens: a change of values, plus a few roles

The palette in `tokens.css` is deep plum ink, warm cream text, a sunny yellow primary
(`--color-accent`, with dark text) and a hot pink second accent (`--color-accent-2`).

- **Pink is used sparingly:** links, the focus ring, and the chosen speed during a match.
- **New roles:**
  - `--color-slab`, `--color-accent-slab` and `--color-accent-2-slab`, with `--shadow-slab`,
    `--shadow-accent-slab` and `--press-depth`: the band under a chunky button.
  - `--color-sticker`, `--radius-large` and `--font-family-symbol`.
  - `--font-weight-display` and `--letter-spacing-display`.
- `--color-won` is now the yellow, so a round's winner reads differently from a favoured matchup
  (green).

### 3. The platform stays calm

- **Chunky buttons.** Buttons, the Back and `?` buttons, and segmented choices sit on a 4 px slab,
  and a press pushes them into it. The slab is part of the button's box, so a press never moves
  anything around it.
- **Disabled buttons** are flat, with no slab to press, and use muted text instead of fading a
  yellow to brown.
- **Cards, tiles and the manual** keep flat fills: no slabs, tilts or second accent.
- **Selection** keeps the violet `--color-selected`. Only the in-match speed toggle (`.speed-toggle`)
  uses pink for its chosen option, and the manual's tabs stay violet.
- Spacing and layouts are untouched (ADR 0031).
- On a phone, long ball names (`data-long`) tighten slightly, so "Necromancer" stays on one line
  in Bricolage's wider letters.

### 4. The energy goes to the arena

**The court** (`drawArena`, `theme.ts`):

- A deep indigo floor (`#1d1640`) with a tonal centre circle (`#251c4b`), inside a chunky rounded
  rim (`#3a2f6e`, 22 world units).
- The court's corner radius equals a ball's radius, so a ball wedged in a corner is never drawn
  over the rim.
- It uses flat fills only, with no gradients or shadows. A frame costs two rounded rectangles and
  a circle, the same on a phone.

**Health pills.** The bars over the balls are chunky pills: a dark track with the fill inset 4
units, so each bar has a dark edge on any ball and floor. The HUD's bars are pills to match.

**The Winner sticker** (`src/ui/winner-sticker.ts`): a tilted cream card on a yellow slab, with
the winner's drawing (the repeat shade in a mirror match), "Winner!" and its name.

- **When it lands.** 750 ms (effect time) before the result: after the knockout's slow-mo and
  shards, and at once for a time-limit end. On a phone the round screen replaces the arena when
  the result shows, so in a series round the sticker gets its moment in between. A quick match's
  result keeps it.
- **Confetti** is capped at 12 pieces (`src/ui/confetti.ts`), in a deterministic burst. It pops
  once in 650 ms, animating only transform and opacity, so the browser composites it without
  touching the canvas.
- **Reduced motion:** the sticker appears without the pop.
- **Accessibility:** it is `aria-hidden`, because the HUD's live region already announces the
  result.

**Other effects.** The winner ring is the yellow and impact particles a warmer yellow. Effects keep
their timings (ADR 0007).

### 5. Every ball stands out on the floor

`arena-contrast.test.ts` checks every ball's colour, and its lighter mirror-match shade, against
both floor tones at WCAG's 3:1 for graphics. It fails for a floor too light for the dark balls: a
`#3a3a4a` centre fails five balls.

The weakest pairs, on the centre circle and then the floor:

| Ball        | Old floor | New floor | Centre |
| ----------- | --------- | --------- | ------ |
| Necromancer | 3.49      | 3.39      | 3.12   |
| Quake       | 3.63      | 3.53      | 3.25   |
| Magnet      | 3.71      | 3.60      | 3.32   |
| Vampire     | 4.40      | 4.28      | 3.94   |
| Storm       | 9.66      | 9.38      | 8.65   |
| Ghost       | 9.43      | 9.17      | 8.45   |
| Frost       | 13.12     | 12.75     | 11.75  |

The pale balls stand out by a wide margin. The dark ones are about where they were on the old
floor, and each keeps its darker `ballOutline` as well.

### 6. Brand images

- `/brand.html` draws with the new palette and font. The link preview's roster is now seven to a
  row: fourteen balls in rows of six ran into the address.
- The icons, the preview, `theme-color` and the manifest are regenerated.
- The preview's alt text no longer counts the balls; it said eleven.

### What came from the references

- **Duolingo:** chunky buttons that press into a slab, and one bright primary per screen.
- **Marvel Snap:** quiet menus and a loud match. The result is a moment, not a line of text.
- **Linear and Raycast:** discipline on the platform. One family, roles rather than palette names,
  depth from fills rather than lines.
- **Balatro:** the tactile, slightly tilted sticker.

## Verification

- **Tests.**
  - `arena-contrast.test.ts`, shown failing with a too-light floor.
  - `confetti.test.ts`: the cap, inside the arena, deterministic.
  - `winner-sticker.browser.test.ts` in Chromium, Firefox and WebKit: the sticker lands after a
    win, names the HUD's winner, keeps 12 pieces, is `aria-hidden` and goes on Replay. It failed
    with the sticker never due.
- **The suites.** Unit, slow and browser suites, lint, typecheck and the build all pass.
- **Screens.** Every screen was captured before and after at 375 × 812 and 1280 × 800, and
  checked at 1440 × 900 and 1920 × 1080: home, Free play, a match and its result, the Best of 3
  rules, lineup, a round, between rounds, the series result, Reveal round 1, the manual (index, an
  entry, the chart) and an older link.

| Screen          | Phone                              | Desktop                              |
| --------------- | ---------------------------------- | ------------------------------------ |
| Home            | ![](0032/home-phone.jpg)           | ![](0032/home-desktop.jpg)           |
| Free play       | ![](0032/free-play-phone.jpg)      | ![](0032/free-play-desktop.jpg)      |
| Match           | ![](0032/match-phone.jpg)          | ![](0032/match-desktop.jpg)          |
| Match result    | ![](0032/match-result-phone.jpg)   | ![](0032/match-result-desktop.jpg)   |
| Best of 3 rules | ![](0032/rules-phone.jpg)          | ![](0032/rules-desktop.jpg)          |
| Lineup          | ![](0032/lineup-phone.jpg)         | ![](0032/lineup-desktop.jpg)         |
| A round         | ![](0032/round-phone.jpg)          | ![](0032/round-desktop.jpg)          |
| Between rounds  | ![](0032/between-rounds-phone.jpg) | ![](0032/between-rounds-desktop.jpg) |
| Series result   | ![](0032/series-result-phone.jpg)  | ![](0032/series-result-desktop.jpg)  |
| Reveal round 1  | ![](0032/reveal-round-1-phone.jpg) | ![](0032/reveal-round-1-desktop.jpg) |
| Manual: balls   | ![](0032/manual-index-phone.jpg)   | ![](0032/manual-index-desktop.jpg)   |
| Manual: entry   | ![](0032/manual-entry-phone.jpg)   | ![](0032/manual-entry-desktop.jpg)   |
| Matchup chart   | ![](0032/matchup-chart-phone.jpg)  | ![](0032/matchup-chart-desktop.jpg)  |
| Older link      | ![](0032/older-link-phone.jpg)     | ![](0032/older-link-desktop.jpg)     |

The bot's lineup is random, so the series screens show different balls before and after.

## Consequences

- **Positive:** the game has a character, and the match is where it shows. The platform stays as
  calm as before, with the same layouts and the same rules.
- **Positive:** the restyle stayed a change of values. The canvas changes are the court, the pills
  and theme colours. The only new code is the sticker, a tested contrast check and a pure confetti
  layout.
- **Negative:** one runtime dependency, the font package. It holds only font files and CSS.
- **Negative:** the sticker covers the middle of the arena at a quick match's result. The last
  frame matters less than who won, and Replay is one tap away.
- **Open:** the Necromancer's name in the HUD (its own dark green on the page) is 3.6:1. It is bold
  but below 4.5:1 for text, as it was on the old page. Ball names take their ball's colour by design
  (ADR 0020), so a fix belongs to a wider look at ball-coloured text.

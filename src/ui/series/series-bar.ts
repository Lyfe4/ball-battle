// What is being played and the legend's ? (ADR 0035, 0038): one quiet line over every pick of a
// series, round 1's included, so the ? sits in the same place on every pick screen. While a round
// is fought on a phone it is the score line instead (ADR 0039): "Round 2 · You 1–0 Bot ▾", which
// opens the full track, so the court keeps the screen.
import type { SeriesSetup } from '../../sim/series.ts';
import { element, setText } from '../dom.ts';
import { aboutLine, aboutParts } from '../series-text.ts';
import { BOT_SEATS, type Seats } from './seats.ts';
import { createSettingsToggle } from '../settings-menu.ts';
import { createSymbolLegend } from '../symbol-legend.ts';
import { markSymbol } from '../symbol-tooltip.ts';
import { scoreText, type ScoreLine } from '../series-text.ts';

/** The track the score line opens: its id, and what a tap on the line does. */
export interface TrackControl {
  readonly id: string;
  readonly onToggle: () => void;
}

export interface SeriesBar {
  /** The line itself: "Best of 3 · Reveal · Hard" (or the score line) and the ?. */
  readonly element: HTMLElement;
  /** The legend the ? opens, to place right after the bar. */
  readonly legend: HTMLElement;
  /** `score` while a round is fought; the phone shows it in place of what is played. */
  show(setup: SeriesSetup, score?: ScoreLine, seats?: Seats): void;
}

/**
 * What is played, as phrases that never break inside ("Best of 3 ·", "Reveal ·", "Hard"): the line
 * wraps only after a dot when the panel is too narrow for it. Called every frame, so it is only
 * rebuilt when the line changes; its text stays "Best of 3 · Reveal · Hard".
 */
function showAbout(about: HTMLElement, setup: SeriesSetup): void {
  const line = aboutLine(setup);
  if (about.dataset['line'] === line) return;
  about.dataset['line'] = line;
  const parts = aboutParts(setup);
  about.replaceChildren(
    ...parts.flatMap((part, index) => {
      const phrase = element(
        'span',
        'series-bar-phrase',
        index < parts.length - 1 ? `${part} ·` : part,
      );
      return index === 0 ? [phrase] : [' ', phrase];
    }),
  );
}

function setAttribute(node: HTMLElement, name: string, value: string): void {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}

export function createSeriesBar(track?: TrackControl): SeriesBar {
  const bar = element('div', 'series-bar');
  const about = element('p', 'series-bar-about');
  const legend = createSymbolLegend();
  const tools = element('div', 'series-bar-tools');
  tools.append(createSettingsToggle(), legend.toggle);
  bar.append(about);

  // The score line: a disclosure for the full track. Only a series panel with a track has one.
  const score = element('button', 'series-bar-score');
  score.type = 'button';
  const scoreWords = element('span', 'series-bar-score-text');
  const more = element('span', 'series-bar-more', '▾');
  more.setAttribute('aria-hidden', 'true');
  markSymbol(more, 'more');
  score.append(scoreWords, more);
  score.hidden = true;
  if (track !== undefined) {
    score.setAttribute('aria-controls', track.id);
    score.addEventListener('click', track.onToggle);
    bar.append(score);
  }
  bar.append(tools);

  return {
    element: bar,
    legend: legend.panel,
    show(setup, line, seats = BOT_SEATS) {
      showAbout(about, setup);
      score.hidden = line === undefined;
      if (line === undefined) return;
      // Called every frame: only changed attributes are written.
      const text = scoreText(line, seats);
      // The line shows the short name; its accessible name says the whole one.
      setText(scoreWords, scoreText(line, seats, true));
      setAttribute(score, 'aria-expanded', String(line.open));
      setAttribute(score, 'aria-label', `${text}: the series track`);
    },
  };
}

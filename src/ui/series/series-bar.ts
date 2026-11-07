// What is being played and the legend's ? (ADR 0035, 0038): one quiet line over every pick of a
// series, round 1's included, so the ? sits in the same place on every pick screen. While a round
// is fought on a phone it is the score line instead (ADR 0039): "Round 2 · You 1–0 Bot ▾", which
// opens the full track, so the court keeps the screen.
import type { SeriesSetup } from '../../sim/series.ts';
import { element, setText } from '../dom.ts';
import { aboutLine, SIDE_NAMES } from '../series-text.ts';
import { createSymbolLegend } from '../symbol-legend.ts';
import { markSymbol } from '../symbol-tooltip.ts';

/** The score line's content while a round is fought. */
export interface ScoreLine {
  /** 0-based. */
  readonly round: number;
  readonly you: number;
  readonly bot: number;
  /** The full track is open under the line. */
  readonly open: boolean;
}

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
  show(setup: SeriesSetup, score?: ScoreLine): void;
}

/** "Round 2 · You 1–0 Bot". */
export function scoreText({ round, you, bot }: ScoreLine): string {
  return `Round ${String(round + 1)} · ${SIDE_NAMES.a} ${String(you)}–${String(bot)} ${SIDE_NAMES.b}`;
}

function setAttribute(node: HTMLElement, name: string, value: string): void {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}

export function createSeriesBar(track?: TrackControl): SeriesBar {
  const bar = element('div', 'series-bar');
  const about = element('p', 'series-bar-about');
  const legend = createSymbolLegend();
  const tools = element('div', 'series-bar-tools');
  tools.append(legend.toggle);
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
    show(setup, line) {
      setText(about, aboutLine(setup));
      score.hidden = line === undefined;
      if (line === undefined) return;
      // Called every frame: only changed attributes are written.
      const text = scoreText(line);
      setText(scoreWords, text);
      setAttribute(score, 'aria-expanded', String(line.open));
      setAttribute(score, 'aria-label', `${text}: the series track`);
    },
  };
}

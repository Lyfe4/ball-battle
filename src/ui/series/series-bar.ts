// What is being played and the legend's ? (ADR 0035, 0038): one quiet line over every pick of a
// series, round 1's included, so the ? sits in the same place on every pick screen.
import type { SeriesSetup } from '../../sim/series.ts';
import { element, setText } from '../dom.ts';
import { aboutLine } from '../series-text.ts';
import { createSymbolLegend } from '../symbol-legend.ts';

export interface SeriesBar {
  /** The line itself: "Best of 3 · Reveal · Hard" and the ?. */
  readonly element: HTMLElement;
  /** The legend the ? opens, to place right after the bar. */
  readonly legend: HTMLElement;
  show(setup: SeriesSetup): void;
}

export function createSeriesBar(): SeriesBar {
  const bar = element('div', 'series-bar');
  const about = element('p', 'series-bar-about');
  const legend = createSymbolLegend();
  bar.append(about, legend.toggle);
  return {
    element: bar,
    legend: legend.panel,
    show(setup) {
      setText(about, aboutLine(setup));
    },
  };
}

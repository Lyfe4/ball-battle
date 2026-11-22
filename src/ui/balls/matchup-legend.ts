import { drawBallIcon } from '../../render/ball-icon.ts';
import type { BallDefinition } from '../../sim/types.ts';
import { element } from '../dom.ts';
import { markSymbol } from '../symbol-tooltip.ts';
import { MARKS, STRONG_MARKS } from './marks.ts';

export interface MatchupLegend {
  readonly element: HTMLElement;
  /** Draws the ball the grid's marks are read against. */
  show(against: BallDefinition): void;
}

const ICON_PX = 16;

/**
 * The key over a grid of marked tiles (the quick setup, ADR 0073): "▲▲ ▲ strong · ▼ ▼▼ weak vs" and
 * the drawing of the ball each tile is read against. The matchup chart needs none: its bands'
 * headings say it (ADR 0073 addendum of 2026-11-23).
 */
export function createMatchupLegend(): MatchupLegend {
  const root = element('p', 'quick-legend');
  // Each tile's name says its mark in words.
  root.setAttribute('aria-hidden', 'true');
  const icon = element('canvas', 'quick-legend-icon');
  const mark = (lean: 'favoured' | 'unfavoured', strong = false) => {
    const span = element('span', 'quick-legend-mark', strong ? STRONG_MARKS[lean] : MARKS[lean]);
    span.dataset['lean'] = lean;
    if (strong) span.dataset['level'] = 'strong';
    const symbol = lean === 'favoured' ? 'strongFavoured' : 'strongUnfavoured';
    markSymbol(span, strong ? symbol : lean);
    return span;
  };
  root.append(
    mark('favoured', true),
    ' ',
    mark('favoured'),
    ' strong · ',
    mark('unfavoured'),
    ' ',
    mark('unfavoured', true),
    ' weak vs ',
    icon,
  );
  return {
    element: root,
    show(against) {
      drawBallIcon(icon, against, ICON_PX);
    },
  };
}

import { ruleCuePoints } from '../render/rule-cue.ts';
import { theme } from '../render/theme.ts';
import { MARKS } from './balls/marks.ts';
import { element } from './dom.ts';

export interface SymbolLegend {
  /** The `?` button, for the screen header. */
  readonly toggle: HTMLButtonElement;
  /** The panel it opens, under the header. */
  readonly panel: HTMLElement;
}

/** Every symbol the screens use, said once (ADR 0025): the mark or swatch and its meaning. */
const ENTRIES: readonly (readonly [symbol: string, meaning: string, swatch?: string])[] = [
  [MARKS.favoured, 'Strong vs: favoured, wins it more often', 'favoured'],
  [MARKS.unfavoured, 'Weak vs: unfavoured, loses it more often', 'unfavoured'],
  [MARKS.even, 'Even matchup (left blank in grids)', 'even'],
  ['?', 'Not shown yet'],
  ['', 'Won the round', 'won'],
  ['', 'Lost the round', 'lost'],
  ['↻', 'Replayed after a draw'],
  ['⚡', 'Sudden death: three draws, decided by a coin flip'],
  ['', 'In a fight: a rule between two balls just kicked in (see each ball)', 'cue'],
];

const SVG = 'http://www.w3.org/2000/svg';

/** The arena's rule cue as a small SVG, the same path the canvas draws (ADR 0028). */
function cueMark(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '-1.3 -1.3 2.6 2.6');
  svg.setAttribute('class', 'symbol-legend-cue');
  const path = document.createElementNS(SVG, 'polygon');
  path.setAttribute(
    'points',
    ruleCuePoints()
      .map(([x, y]) => `${String(x)},${String(y)}`)
      .join(' '),
  );
  path.setAttribute('fill', theme.ruleCueFill);
  path.setAttribute('stroke', theme.ruleCueOutline);
  path.setAttribute('stroke-width', '0.22');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

let legends = 0;

/**
 * The symbol legend: a `?` button in a screen's header that opens a short list of what each mark
 * means, so a screen can show symbols instead of sentences. A disclosure (aria-expanded), closed
 * by default; Escape closes it and returns focus to the button.
 */
export function createSymbolLegend(): SymbolLegend {
  legends += 1;
  const id = `symbol-legend-${String(legends)}`;
  const toggle = element('button', 'symbol-legend-toggle', '?');
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'What the symbols mean');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', id);

  const panel = element('section', 'symbol-legend');
  panel.id = id;
  panel.setAttribute('aria-label', 'Symbols');
  panel.hidden = true;
  const list = element('ul', 'symbol-legend-list');
  list.append(
    ...ENTRIES.map(([symbol, meaning, swatch]) => {
      const item = element('li', 'symbol-legend-item');
      const mark = element('span', 'symbol-legend-mark', symbol);
      mark.setAttribute('aria-hidden', 'true');
      if (swatch === 'cue') mark.append(cueMark());
      else if (swatch !== undefined) mark.dataset['swatch'] = swatch;
      item.append(mark, element('span', '', meaning));
      return item;
    }),
  );
  panel.append(list, element('p', 'symbol-legend-note', 'Favoured is never certain.'));

  // While open, Escape closes it wherever focus is, and focus returns to the ?.
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    open(false);
    toggle.focus();
  };
  function open(expanded: boolean): void {
    panel.hidden = !expanded;
    toggle.setAttribute('aria-expanded', String(expanded));
    if (expanded) document.addEventListener('keydown', onKey);
    else document.removeEventListener('keydown', onKey);
  }
  toggle.addEventListener('click', () => {
    open(toggle.getAttribute('aria-expanded') !== 'true');
  });
  return { toggle, panel };
}

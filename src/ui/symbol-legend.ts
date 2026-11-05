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
  [MARKS.favoured, 'Favoured: wins this matchup more often', 'favoured'],
  [MARKS.unfavoured, 'Unfavoured: loses it more often', 'unfavoured'],
  [MARKS.even, 'Even matchup (left blank in grids)', 'even'],
  ['?', 'Not shown yet'],
  ['', 'Won the round', 'won'],
  ['', 'Lost the round', 'lost'],
  ['↻', 'Replayed after a draw'],
  ['⚡', 'Sudden death: three draws, decided by a coin flip'],
];

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
      if (swatch !== undefined) mark.dataset['swatch'] = swatch;
      item.append(mark, element('span', '', meaning));
      return item;
    }),
  );
  panel.append(list, element('p', 'symbol-legend-note', 'Favoured is never certain.'));

  const open = (expanded: boolean) => {
    panel.hidden = !expanded;
    toggle.setAttribute('aria-expanded', String(expanded));
  };
  toggle.addEventListener('click', () => {
    open(toggle.getAttribute('aria-expanded') !== 'true');
  });
  panel.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    open(false);
    toggle.focus();
  });
  toggle.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') open(false);
  });
  return { toggle, panel };
}

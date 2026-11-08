import { element } from './dom.ts';
import { SYMBOL_KEYS, SYMBOLS } from './symbols.ts';

export interface SymbolLegend {
  /** The `?` button, for the screen header. */
  readonly toggle: HTMLButtonElement;
  /** The panel it opens, under the header. */
  readonly panel: HTMLElement;
}

/** Symbols drawn as a swatch (a colour or a ring) rather than as plain text. */
const SWATCHES = new Set(['favoured', 'unfavoured', 'even', 'won', 'lost']);

let legends = 0;

/**
 * The symbol legend: a `?` button in a screen's header that opens a short list of what each mark
 * means, so a screen can show symbols instead of sentences. A disclosure (aria-expanded), closed
 * by default, opening in place under the ?; the ?, the Close at its end and Escape each close it
 * and return focus to the ?.
 */
export function createSymbolLegend(): SymbolLegend {
  legends += 1;
  const id = `symbol-legend-${String(legends)}`;
  const toggle = element('button', 'symbol-legend-toggle', '?');
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'What the symbols mean');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', id);

  const panel = element('section', 'info-panel symbol-legend');
  panel.id = id;
  panel.setAttribute('aria-label', 'Symbols');
  panel.hidden = true;
  const list = element('ul', 'symbol-legend-list');
  list.append(
    ...SYMBOL_KEYS.map((key) => {
      const { mark: symbol, meaning, legendNote } = SYMBOLS[key];
      const item = element('li', 'symbol-legend-item');
      const mark = element('span', 'symbol-legend-mark', symbol);
      mark.setAttribute('aria-hidden', 'true');
      if (SWATCHES.has(key)) mark.dataset['swatch'] = key;
      const words = legendNote === undefined ? meaning : `${meaning} (${legendNote})`;
      item.append(mark, element('span', '', words));
      return item;
    }),
  );
  // Its own way out at its end (ADR 0038), so it closes even when the ? has scrolled out of view.
  const close = element('button', 'text-link panel-close symbol-legend-close', 'Close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close the legend');
  close.addEventListener('click', () => {
    open(false);
    toggle.focus();
  });
  panel.append(list, element('p', 'symbol-legend-note', 'Favoured is never certain.'), close);

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

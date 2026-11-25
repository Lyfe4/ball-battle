import { createCloseButton } from './close-button.ts';
import { element } from './dom.ts';
import { SYMBOL_KEYS, SYMBOLS } from './symbols.ts';

export interface SymbolLegend {
  /** The `?` button, for the screen header. */
  readonly toggle: HTMLButtonElement;
  /** The panel it opens, under the header. */
  readonly panel: HTMLElement;
}

/** Symbols drawn as a swatch (a colour or a ring) rather than as plain text. */
const SWATCHES = new Set([
  'strongFavoured',
  'favoured',
  'even',
  'unfavoured',
  'strongUnfavoured',
  'won',
  'lost',
]);

let legends = 0;

/**
 * The symbol legend: a `?` button in a screen's header that opens a short list of what each mark
 * means, so a screen can show symbols instead of sentences. A disclosure (aria-expanded), closed
 * by default, opening in place under the ?; the ?, the × in its head and Escape each close it
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
  panel.hidden = true;
  const title = element('h2', 'info-panel-title symbol-legend-title', 'Symbols');
  title.id = `${id}-title`;
  panel.setAttribute('aria-labelledby', title.id);
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
  // Its own way out (ADR 0038), the one close every overlay has: the × last in its head (ADR 0086).
  const close = createCloseButton(() => {
    open(false);
    toggle.focus();
  });
  close.classList.add('symbol-legend-close');
  const head = element('div', 'info-panel-head');
  head.append(title, close);
  panel.append(head, list, element('p', 'symbol-legend-note', 'Favoured is never certain.'));

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

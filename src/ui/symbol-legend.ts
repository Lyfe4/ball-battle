import { ruleCuePoints } from '../render/rule-cue.ts';
import { theme } from '../render/theme.ts';
import type { Tips } from '../app/tips.ts';
import { element } from './dom.ts';
import { SYMBOL_KEYS, SYMBOLS } from './symbols.ts';

export interface SymbolLegend {
  /** The `?` button, for the screen header. */
  readonly toggle: HTMLButtonElement;
  /** The panel it opens, under the header. */
  readonly panel: HTMLElement;
}

/** Symbols drawn as a swatch (a colour, a ring, the cue) rather than as plain text. */
const SWATCHES = new Set(['favoured', 'unfavoured', 'even', 'won', 'lost', 'cue']);

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

/** The page's tips in the arena (ADR 0036), set once by main.ts so every legend can switch them. */
let pageTips: Tips | undefined;
export function installLegendTips(tips: Tips): void {
  pageTips = tips;
}

/** The legend's last line: tips in the arena on or off, and a way to see them all again. */
function tipsRow(): HTMLElement {
  const row = element('p', 'symbol-legend-tips');
  const toggle = element('button', 'text-link');
  toggle.type = 'button';
  const again = element('button', 'text-link', 'Show tips again');
  again.type = 'button';
  const render = () => {
    const on = pageTips?.enabled() ?? true;
    toggle.textContent = on ? 'Turn tips off' : 'Turn tips on';
    toggle.setAttribute('aria-pressed', String(!on));
  };
  toggle.addEventListener('click', () => {
    pageTips?.setEnabled(!pageTips.enabled());
    render();
  });
  again.addEventListener('click', () => {
    pageTips?.reset();
    render();
    again.textContent = 'Tips will show again';
  });
  row.append(element('span', '', 'Tips in the arena: '), toggle, ' · ', again);
  row.hidden = pageTips === undefined;
  render();
  return row;
}

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

  const panel = element('section', 'symbol-legend');
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
      if (key === 'cue') mark.append(cueMark());
      else if (SWATCHES.has(key)) mark.dataset['swatch'] = key;
      const words = legendNote === undefined ? meaning : `${meaning} (${legendNote})`;
      item.append(mark, element('span', '', words));
      return item;
    }),
  );
  // Its own way out at its end (ADR 0038), so it closes even when the ? has scrolled out of view.
  const close = element('button', 'text-link symbol-legend-close', 'Close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close the legend');
  close.addEventListener('click', () => {
    open(false);
    toggle.focus();
  });
  panel.append(
    list,
    element('p', 'symbol-legend-note', 'Favoured is never certain.'),
    tipsRow(),
    close,
  );

  // While open, Escape closes it wherever focus is, and focus returns to the ?.
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    open(false);
    toggle.focus();
  };
  function open(expanded: boolean): void {
    panel.hidden = !expanded;
    // The tips may have changed on another screen's legend since this one was built.
    if (expanded) panel.querySelector('.symbol-legend-tips')?.replaceWith(tipsRow());
    toggle.setAttribute('aria-expanded', String(expanded));
    if (expanded) document.addEventListener('keydown', onKey);
    else document.removeEventListener('keydown', onKey);
  }
  toggle.addEventListener('click', () => {
    open(toggle.getAttribute('aria-expanded') !== 'true');
  });
  return { toggle, panel };
}

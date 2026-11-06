// A small tooltip that says what a symbol means (ADR 0030), for players with a mouse or a keyboard:
// hovering a symbol with a mouse, or moving keyboard focus onto a control that shows symbols. Its
// words come from the same table as the symbol legend (symbols.ts), so the two never disagree.
// Touch adds nothing: a tap is a press, and the legend stays the way to look a symbol up there.
// One tooltip serves the whole page, found by event delegation on `[data-symbol]`, so a screen only
// names its symbols (`markSymbol`) and never wires a tooltip of its own.
import { element } from './dom.ts';
import { tooltipLines, type SymbolKey } from './symbols.ts';
import { placeTooltip } from './tooltip-place.ts';

const SYMBOL = '[data-symbol]';

/** Names the symbol `node` shows, so the tooltip can say what it means; undefined clears it. */
export function markSymbol(node: HTMLElement, key: SymbolKey | undefined): void {
  if (key === undefined) delete node.dataset['symbol'];
  else node.dataset['symbol'] = key;
}

/** The symbols an element shows: itself if it is one, else the ones inside it, in order. */
function symbolsIn(node: Element): readonly HTMLElement[] {
  if (node instanceof HTMLElement && node.matches(SYMBOL)) return [node];
  return [...node.querySelectorAll<HTMLElement>(SYMBOL)].filter(
    (symbol) => symbol.getClientRects().length > 0,
  );
}

/** Installs the page's one symbol tooltip. Call once, from main.ts. */
export function installSymbolTooltips(doc: Document = document): void {
  const tip = element('div', 'symbol-tooltip');
  // Every symbol already has its words in its control's accessible name; this is for the eyes.
  tip.setAttribute('aria-hidden', 'true');
  tip.hidden = true;
  doc.body.append(tip);
  let anchor: Element | undefined;

  function show(on: Element, symbols: readonly HTMLElement[]): void {
    const lines = tooltipLines(symbols.map((symbol) => symbol.dataset['symbol']));
    if (lines.length === 0) {
      hide();
      return;
    }
    anchor = on;
    tip.replaceChildren(...lines.map((line) => element('span', 'symbol-tooltip-line', line)));
    tip.hidden = false;
    const box = (symbols.length === 1 ? symbols[0] : on)?.getBoundingClientRect();
    if (box === undefined) return;
    const view = doc.documentElement;
    const at = placeTooltip(
      box,
      { width: tip.offsetWidth, height: tip.offsetHeight },
      { width: view.clientWidth, height: view.clientHeight },
    );
    tip.style.left = `${String(at.left)}px`;
    tip.style.top = `${String(at.top)}px`;
  }

  function hide(): void {
    anchor = undefined;
    tip.hidden = true;
  }

  doc.addEventListener('pointerover', (event) => {
    // A mouse only: touch and pen presses never open it.
    if (event.pointerType !== 'mouse' || !(event.target instanceof Element)) return;
    const symbol = event.target.closest<HTMLElement>(SYMBOL);
    if (symbol === null) {
      if (anchor !== undefined && !anchor.contains(event.target)) hide();
      return;
    }
    if (symbol !== anchor) show(symbol, [symbol]);
  });
  doc.addEventListener('pointerout', (event) => {
    if (anchor === undefined || event.pointerType !== 'mouse') return;
    const to = event.relatedTarget;
    if (!(to instanceof Node) || !anchor.contains(to)) hide();
  });
  doc.addEventListener('focusin', (event) => {
    const target = event.target;
    // Keyboard focus only: a tap or a click focuses without :focus-visible.
    if (!(target instanceof HTMLElement) || !target.matches(':focus-visible')) return;
    const symbols = symbolsIn(target);
    if (symbols.length > 0) show(target, symbols);
    else hide();
  });
  doc.addEventListener('focusout', () => {
    hide();
  });
  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hide();
  });
  // A tooltip left behind by scrolling would point at nothing.
  doc.addEventListener('scroll', hide, { capture: true, passive: true });
}

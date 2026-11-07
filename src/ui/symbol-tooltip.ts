// A small tooltip that says what a symbol means (ADR 0030, 0035, 0037): hovering a symbol with a
// mouse, moving keyboard focus onto a control that shows symbols, or a tap. A matchup mark carries
// its own words naming both balls and who has the edge (`tip`); other symbols use the legend's
// words (symbols.ts), so the two never disagree. On a touch screen a mark that must be readable is
// its own tap target (`tap`, a badge beside the control it describes): a tap on it explains it and
// never presses anything else. A tap on a symbol that is not part of a control explains it too.
// There is no press-and-hold: on phones it opened the browser's own selection menu instead.
// One tooltip serves the whole page, found by event delegation on `[data-symbol]`, so a screen only
// names its symbols (`markSymbol`) and never wires a tooltip of its own.
import { element } from './dom.ts';
import { tooltipLines, type SymbolKey } from './symbols.ts';
import { placeTooltip } from './tooltip-place.ts';

const SYMBOL = '[data-symbol]';
/** A badge that explains its mark on a tap (or click), instead of pressing the row around it. */
const TAP = '[data-symbol-tap]';
/** Where a control's symbols are listed from when it takes keyboard focus (a pick row). */
const SCOPE = '[data-symbol-scope]';
/** A control a tap presses: a symbol inside one is explained by hover or focus, not a tap. */
const CONTROL = 'button, a[href], [role="button"], input, select, label';
/** A tooltip opened by a tap closes by itself after this long. */
export const TAP_SHOW_MS = 4000;

export interface SymbolOptions {
  /** This mark's own words (a matchup: both balls and who has the edge, then why). */
  readonly tip?: readonly string[];
  /** The mark is its own tap target: a tap explains it. */
  readonly tap?: boolean;
}

/** Names the symbol `node` shows, so the tooltip can say what it means; undefined clears it. */
export function markSymbol(
  node: HTMLElement,
  key: SymbolKey | undefined,
  options: SymbolOptions = {},
): void {
  if (key === undefined) {
    delete node.dataset['symbol'];
    delete node.dataset['tip'];
    return;
  }
  node.dataset['symbol'] = key;
  if (options.tip === undefined) delete node.dataset['tip'];
  else node.dataset['tip'] = options.tip.join('\n');
  if (options.tap === true) node.dataset['symbolTap'] = '';
}

/** The symbols an element shows: itself if it is one, else the ones inside it, in order. */
function symbolsIn(node: Element): readonly HTMLElement[] {
  if (node instanceof HTMLElement && node.matches(SYMBOL)) return [node];
  return [...node.querySelectorAll<HTMLElement>(SYMBOL)].filter(
    (symbol) => symbol.getClientRects().length > 0,
  );
}

/**
 * What the tooltip says for `symbols`: one symbol says all its words (a matchup's edge and why);
 * several say one line each (a matchup's edge, else the legend's meaning), each once.
 */
export function linesOf(symbols: readonly HTMLElement[]): readonly string[] {
  const tips = symbols.map((symbol) => symbol.dataset['tip']?.split('\n'));
  const [only] = tips;
  if (symbols.length === 1 && only !== undefined) return only;
  const lines = symbols.map(
    (symbol, index) => tips[index]?.[0] ?? tooltipLines([symbol.dataset['symbol']])[0],
  );
  return [...new Set(lines.filter((line) => line !== undefined))];
}

/** Installs the page's one symbol tooltip. Call once, from main.ts. */
export function installSymbolTooltips(doc: Document = document): void {
  const tip = element('div', 'symbol-tooltip');
  // Every symbol already has its words in its control's accessible name; this is for the eyes.
  tip.setAttribute('aria-hidden', 'true');
  tip.hidden = true;
  doc.body.append(tip);
  let anchor: Element | undefined;
  const view = doc.defaultView ?? window;
  let closeTimer: number | undefined;
  /** True while the tooltip shows for a tap, which focus moving or the mouse leaving must not close. */
  let byTap = false;

  function show(on: Element, symbols: readonly HTMLElement[]): void {
    const lines = linesOf(symbols);
    if (lines.length === 0) {
      hide();
      return;
    }
    anchor = on;
    tip.replaceChildren(
      ...lines.map((line, index) =>
        element('span', index === 0 ? 'symbol-tooltip-line' : 'symbol-tooltip-why', line),
      ),
    );
    tip.hidden = false;
    const box = (symbols.length === 1 ? symbols[0] : on)?.getBoundingClientRect();
    if (box === undefined) return;
    const page = doc.documentElement;
    const at = placeTooltip(
      box,
      { width: tip.offsetWidth, height: tip.offsetHeight },
      { width: page.clientWidth, height: page.clientHeight },
    );
    tip.style.left = `${String(at.left)}px`;
    tip.style.top = `${String(at.top)}px`;
  }

  function hide(): void {
    anchor = undefined;
    byTap = false;
    tip.hidden = true;
  }

  function showForTap(symbol: HTMLElement): void {
    show(symbol, [symbol]);
    byTap = true;
    if (closeTimer !== undefined) view.clearTimeout(closeTimer);
    closeTimer = view.setTimeout(hide, TAP_SHOW_MS);
  }

  doc.addEventListener('pointerover', (event) => {
    // A mouse only: touch and pen presses never open it by passing over.
    if (event.pointerType !== 'mouse' || !(event.target instanceof Element)) return;
    const symbol = event.target.closest<HTMLElement>(SYMBOL);
    if (symbol === null) {
      if (anchor !== undefined && !byTap && !anchor.contains(event.target)) hide();
      return;
    }
    if (symbol !== anchor) show(symbol, [symbol]);
  });
  doc.addEventListener('pointerout', (event) => {
    if (anchor === undefined || byTap || event.pointerType !== 'mouse') return;
    const to = event.relatedTarget;
    if (!(to instanceof Node) || !anchor.contains(to)) hide();
  });
  doc.addEventListener('focusin', (event) => {
    const target = event.target;
    // Keyboard focus only: a tap or a click focuses without :focus-visible.
    if (!(target instanceof HTMLElement) || !target.matches(':focus-visible')) return;
    const scope = target.closest(SCOPE) ?? target;
    const symbols = symbolsIn(scope);
    if (symbols.length > 0) show(scope, symbols);
    else hide();
  });
  doc.addEventListener('focusout', () => {
    if (!byTap) hide();
  });
  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hide();
  });

  // Any press elsewhere closes a tooltip that is open.
  doc.addEventListener('pointerdown', (event) => {
    if (anchor === undefined || !(event.target instanceof Element)) return;
    if (event.target.closest(SYMBOL) !== anchor) hide();
  });
  // A tap (or click) on a tap badge, or on a symbol that is not part of a control, explains it.
  // The badge sits beside the control it describes, so the control never sees this click.
  doc.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const symbol = event.target.closest<HTMLElement>(SYMBOL);
    if (symbol === null) return;
    if (symbol.matches(TAP) || symbol.closest(CONTROL) === null) showForTap(symbol);
  });
  // A long press on a mark or a pick row would otherwise open the browser's own menu.
  doc.addEventListener('contextmenu', (event) => {
    if (event.target instanceof Element && event.target.closest(`${SYMBOL}, ${SCOPE}`) !== null) {
      event.preventDefault();
    }
  });
  // Nor start a text selection (iOS shows its copy menu for one).
  doc.addEventListener('selectstart', (event) => {
    const target = event.target;
    const at = target instanceof Element ? target : (target as Node | null)?.parentElement;
    if ((at?.closest(`${SYMBOL}, ${SCOPE}, .ball-tile, .quick-slot`) ?? null) !== null) {
      event.preventDefault();
    }
  });
  // A tooltip left behind by scrolling would point at nothing.
  doc.addEventListener('scroll', hide, { capture: true, passive: true });
}

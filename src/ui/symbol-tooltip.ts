// A small tooltip that says what a symbol means (ADR 0030, 0035): hovering a symbol with a mouse,
// moving keyboard focus onto a control that shows symbols, or on a touch screen tapping a symbol
// that is not part of a control, or pressing and holding one that is (a pick row, a grid tile),
// where a plain tap still presses the control. Its words come from the same table as the symbol
// legend (symbols.ts), so the two never disagree. Screens that ask the player to read marks also
// show a one-line key, so no gesture is ever needed to read them. One tooltip serves the whole page, found by event delegation on `[data-symbol]`, so a screen only
// names its symbols (`markSymbol`) and never wires a tooltip of its own.
import { element } from './dom.ts';
import { tooltipLines, type SymbolKey } from './symbols.ts';
import { placeTooltip } from './tooltip-place.ts';

const SYMBOL = '[data-symbol]';
/** A control a tap presses: a symbol inside one is explained by pressing and holding. */
const CONTROL = 'button, a[href], [role="button"], input, select, label';
/** How long a press is held before it explains the symbol instead of pressing the control. */
export const HOLD_MS = 450;
/** A touch that moves further than this is a scroll, not a tap or a hold. */
const SLOP_PX = 10;
/** A tooltip opened by touch closes by itself after this long. */
const TOUCH_SHOW_MS = 3000;

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

  /** True while the tooltip shows for a touch, which focus moving must not close. */
  let byTouch = false;

  function hide(): void {
    anchor = undefined;
    byTouch = false;
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
    // A touch's compatibility mouse events move focus after the tooltip opened: keep it.
    if (!byTouch) hide();
  });
  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hide();
  });

  // Touch: a tap on a symbol outside a control, or a held press on one inside a control.
  const view = doc.defaultView ?? window;
  let press: { x: number; y: number; symbol: HTMLElement; held: boolean } | undefined;
  let holdTimer: number | undefined;
  let closeTimer: number | undefined;
  /** Set once a hold has explained a symbol, so the click that follows doesn't press the control. */
  let swallowClick = false;
  const stopHold = () => {
    if (holdTimer !== undefined) view.clearTimeout(holdTimer);
    holdTimer = undefined;
  };
  const showForTouch = (symbol: HTMLElement) => {
    show(symbol, [symbol]);
    byTouch = true;
    if (closeTimer !== undefined) view.clearTimeout(closeTimer);
    closeTimer = view.setTimeout(hide, TOUCH_SHOW_MS);
  };
  doc.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch' || !(event.target instanceof Element)) return;
    const symbol = event.target.closest<HTMLElement>(SYMBOL);
    // Any other touch closes a tooltip that is open.
    if (symbol !== anchor) hide();
    swallowClick = false;
    stopHold();
    if (symbol === null) {
      press = undefined;
      return;
    }
    press = { x: event.clientX, y: event.clientY, symbol, held: false };
    if (symbol.closest(CONTROL) === null) return;
    holdTimer = view.setTimeout(() => {
      if (press === undefined) return;
      press.held = true;
      swallowClick = true;
      showForTouch(press.symbol);
    }, HOLD_MS);
  });
  doc.addEventListener('pointermove', (event) => {
    if (press === undefined || event.pointerType !== 'touch') return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > SLOP_PX) {
      press = undefined;
      stopHold();
    }
  });
  doc.addEventListener('pointercancel', () => {
    press = undefined;
    stopHold();
  });
  doc.addEventListener('pointerup', (event) => {
    if (press === undefined || event.pointerType !== 'touch') return;
    stopHold();
    const { symbol, held } = press;
    press = undefined;
    // A tap on a symbol that is not part of a control explains it.
    if (!held && symbol.closest(CONTROL) === null) showForTouch(symbol);
  });
  // Capture, so the control under a held press never sees the click that ends it.
  doc.addEventListener(
    'click',
    (event) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    },
    { capture: true },
  );
  // A long press would otherwise open the browser's own menu over the tooltip.
  doc.addEventListener('contextmenu', (event) => {
    if (event.target instanceof Element && event.target.closest(SYMBOL) !== null) {
      event.preventDefault();
    }
  });
  // A tooltip left behind by scrolling would point at nothing.
  doc.addEventListener('scroll', hide, { capture: true, passive: true });
}

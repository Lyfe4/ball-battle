// One close per overlay (ADR 0086): the × last in an overlay's head, the same control in every one
// (What to play, settings, the symbol legend, and the sheets to come). A 44 px target named
// "Close" (the overlay names itself), drawn as a quiet disc that fills when pointed at or pressed.
// Tap outside, Escape and Back close an overlay as well; nothing else in it says Close or Done.
import { element } from './dom.ts';

const SVG = 'http://www.w3.org/2000/svg';

/** The × itself: two strokes in the text colour, hidden from screen readers (the name says it). */
function glyph(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'close-button-glyph');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', 'M5 5 15 15M15 5 5 15');
  svg.append(path);
  return svg;
}

/** The shared × for an overlay's head; `onClose` closes the overlay (and returns focus). */
export function createCloseButton(onClose: () => void): HTMLButtonElement {
  const button = element('button', 'close-button');
  button.type = 'button';
  button.setAttribute('aria-label', 'Close');
  // Back and Close sound alike (ADR 0070).
  button.dataset['sound'] = 'back';
  button.append(glyph());
  button.addEventListener('click', onClose);
  return button;
}

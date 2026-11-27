// Our own plain shapes (ADR 0081): the tabs' icons (a ball in motion, four balls, two heads, a
// podium with a star), the Play box's opponents (the bot's face, two heads for a friend) and a
// link (who-sheet.ts).
// Drawn in the text's colour, hidden from screen readers: the words beside them say it.
const SVG = 'http://www.w3.org/2000/svg';

const FRIENDS =
  'M9 4a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7ZM2 20a7 6 0 0 1 14 0ZM16.5 5a3 3 0 1 1 0 6a3 3 0 1 1 0-6ZM17.5 20a8 7 0 0 0-2.6-6.6a6 5 0 0 1 7.1 6.6Z';

const SHAPES = {
  play: 'M14 4a6 6 0 1 1 0 12a6 6 0 1 1 0-12ZM2 9h5v2H2ZM3 13h4v2H3ZM5 17h4v2H5Z',
  balls:
    'M7 4a4 4 0 1 1 0 8a4 4 0 1 1 0-8ZM17 4a4 4 0 1 1 0 8a4 4 0 1 1 0-8ZM7 13a4 4 0 1 1 0 8a4 4 0 1 1 0-8ZM17 13a4 4 0 1 1 0 8a4 4 0 1 1 0-8Z',
  friends: FRIENDS,
  ranks:
    'M9 7h6v14H9ZM2 12h6v9H2ZM16 15h6v6h-6ZM12 1.5l1.2 2.4l2.6.4l-1.9 1.8l.5 2.6L12 7.5L9.6 8.7l.5-2.6L8.2 4.3l2.6-.4Z',
  bot: 'M11 2h2v3h-2ZM5 6h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2ZM8.5 10a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3ZM15.5 10a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3ZM8 15h8v1.5H8Z',
  friend: FRIENDS,
  // Two links of a chain and the bar between them: "Send a link instead" (ADR 0089 addendum).
  link: 'M10 8H7a4 4 0 0 0 0 8h3v-2H7a2 2 0 0 1 0-4h3ZM14 8h3a4 4 0 0 1 0 8h-3v-2h3a2 2 0 0 0 0-4h-3ZM8 11h8v2H8Z',
} as const;

export type Shape = keyof typeof SHAPES;

export function shapeIcon(shape: Shape, className: string): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', className);
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', SHAPES[shape]);
  // The bot's eyes and mouth are holes in its face.
  if (shape === 'bot') path.setAttribute('fill-rule', 'evenodd');
  svg.append(path);
  return svg;
}

import { element } from './dom.ts';

/** One tile of a coming-soon card: what it will show, and a dash until it does. */
export interface SoonTile {
  readonly label: string;
}

/**
 * A card for something not built yet (ADR 0081): its title with a cream "Coming soon" sticker, a
 * line of what it will be, and tiles that show only a dash. One look for every such card: Profile's stats, the Ranks tab's
 * boards. It reads nothing; the words say plainly that it is coming.
 */
export function createComingSoon(
  title: string,
  tiles: readonly SoonTile[],
  line?: string,
  /** Inside a card already (Profile's): no card of its own, its edges on the card's. */
  flat = false,
): HTMLElement {
  const card = element('section', flat ? 'soon-card soon-card-flat' : 'soon-card');
  card.setAttribute('aria-label', `${title}, coming soon`);
  const head = element('div', 'soon-card-head');
  head.append(
    element('h2', 'soon-card-title', title),
    element('span', 'soon-sticker', 'Coming soon'),
  );
  const list = element('dl', 'soon-card-tiles');
  for (const tile of tiles) {
    const item = element('div', 'soon-card-tile');
    const value = element('dd', '', '–');
    // A dash says nothing to a screen reader: "not yet" does.
    value.setAttribute('aria-label', 'not yet');
    item.append(element('dt', '', tile.label), value);
    list.append(item);
  }
  card.append(head);
  if (line !== undefined) card.append(element('p', 'soon-card-line', line));
  if (tiles.length > 0) card.append(list);
  return card;
}

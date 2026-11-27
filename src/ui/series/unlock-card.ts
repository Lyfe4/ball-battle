// The first series' unlock (ADR 0090 addendum "The unlock moment", 1e): at its result, win or lose,
// once, a reward card by the result sticker: a gold outline, "New: more ways to play" and a row of
// small icons, one per new way. Folded, it is one row, so Rematch and Home stay on a 390 x 664
// screen; a tap opens it to the lines, each beside its icon. It comes in after the sticker has
// landed, on the motion tokens (a fade with reduced motion).
import { element } from '../dom.ts';
import { NEW_WAYS_TITLE, NEW_WAYS_WHERE, type NewWay } from '../first-series-text.ts';
import { shapeIcon } from '../icons.ts';

export interface UnlockCard {
  readonly element: HTMLElement;
  /** Shows these ways (built once per list), or nothing. */
  show(ways: readonly NewWay[] | undefined): void;
}

export function createUnlockCard(): UnlockCard {
  const root = element('details', 'unlock-card');
  root.hidden = true;
  let shown = '';
  return {
    element: root,
    show(ways) {
      const key = ways === undefined ? '' : JSON.stringify(ways);
      if (key === shown) return;
      shown = key;
      root.hidden = ways === undefined;
      root.open = false;
      if (ways === undefined) {
        root.replaceChildren();
        return;
      }
      const summary = element('summary', 'unlock-summary');
      const icons = element('span', 'unlock-icons');
      icons.append(...ways.map((way) => shapeIcon(way.icon, 'unlock-icon')));
      summary.append(element('span', 'unlock-title', NEW_WAYS_TITLE), icons);
      const list = element('ul', 'unlock-list');
      list.append(
        ...ways.map((way) => {
          const item = element('li', 'unlock-item');
          item.append(shapeIcon(way.icon, 'unlock-icon'), element('span', '', way.text));
          return item;
        }),
      );
      root.replaceChildren(summary, list, element('p', 'unlock-where', NEW_WAYS_WHERE));
    },
  };
}

// The shell's tab bar (ADR 0081): a bar along the bottom of a phone held upright, a rail down the
// left beside (any landscape screen, ADR 0067), with the words beside the icons on a desktop. Each
// tab is a link to its screen's URL, so it works as a link does (a new tab, a long press); a plain
// tap moves by the Back rules instead of loading the page. The current tab is marked for screen
// readers (`aria-current="page"`). Each tab holds a badge slot, empty until something waits there.
// It shows on the tab screens alone: `body[data-tabs]` makes room for it (tab-bar.css).
import type { Tab, TabId } from '../app/tabs.ts';
import { element, setAttr, setHidden, setText } from './dom.ts';

export interface TabBar {
  readonly element: HTMLElement;
  /** The tab on show, or none: the bar hides (a fight, a setup, any screen that isn't a tab). */
  show(current: TabId | undefined): void;
  /** What waits in `id` (its badge, none at zero) and the tab's accessible name with it. */
  badge(id: TabId, count: number, label: string): void;
}

const SVG = 'http://www.w3.org/2000/svg';

/** Our own plain shapes: a ball in motion, four balls, two heads, a podium with a star. */
const ICONS: Readonly<Record<TabId, string>> = {
  play: 'M14 4a6 6 0 1 1 0 12a6 6 0 1 1 0-12ZM2 9h5v2H2ZM3 13h4v2H3ZM5 17h4v2H5Z',
  balls:
    'M7 4a4 4 0 1 1 0 8a4 4 0 1 1 0-8ZM17 4a4 4 0 1 1 0 8a4 4 0 1 1 0-8ZM7 13a4 4 0 1 1 0 8a4 4 0 1 1 0-8ZM17 13a4 4 0 1 1 0 8a4 4 0 1 1 0-8Z',
  friends:
    'M9 4a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7ZM2 20a7 6 0 0 1 14 0ZM16.5 5a3 3 0 1 1 0 6a3 3 0 1 1 0-6ZM17.5 20a8 7 0 0 0-2.6-6.6a6 5 0 0 1 7.1 6.6Z',
  ranks:
    'M9 7h6v14H9ZM2 12h6v9H2ZM16 15h6v6h-6ZM12 1.5l1.2 2.4l2.6.4l-1.9 1.8l.5 2.6L12 7.5L9.6 8.7l.5-2.6L8.2 4.3l2.6-.4Z',
};

function icon(id: TabId): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'tab-bar-icon');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', ICONS[id]);
  svg.append(path);
  return svg;
}

/**
 * `hrefOf` writes a tab's URL (its `href`, for a link opened elsewhere); `open` moves to it on a
 * plain tap.
 */
export function createTabBar(
  tabs: readonly Tab[],
  hrefOf: (tab: Tab) => string,
  open: (tab: Tab) => void,
): TabBar {
  const nav = element('nav', 'tab-bar');
  nav.setAttribute('aria-label', 'Main');
  nav.hidden = true;
  const list = element('ul', 'tab-bar-list');
  const links = tabs.map((tab) => {
    const link = element('a', 'tab-bar-tab');
    link.href = hrefOf(tab);
    link.dataset['tab'] = tab.id;
    const badge = element('span', 'tab-bar-badge');
    badge.hidden = true;
    link.append(icon(tab.id), element('span', 'tab-bar-label', tab.label), badge);
    link.addEventListener('click', (event) => {
      // A tap moves within the page; a modified click (a new tab or window) stays a link's.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
        return;
      event.preventDefault();
      open(tab);
    });
    const item = element('li', 'tab-bar-item');
    item.append(link);
    list.append(item);
    return { tab, link, badge };
  });
  nav.append(list);
  return {
    element: nav,
    show(current) {
      setHidden(nav, current === undefined);
      document.body.toggleAttribute('data-tabs', current !== undefined);
      for (const { tab, link } of links) {
        if (tab.id === current) setAttr(link, 'aria-current', 'page');
        else if (link.hasAttribute('aria-current')) link.removeAttribute('aria-current');
      }
    },
    badge(id, count, label) {
      const found = links.find(({ tab }) => tab.id === id);
      if (found === undefined) return;
      setText(found.badge, count > 9 ? '9+' : String(count));
      setHidden(found.badge, count === 0);
      // The count is in the tab's name ("Friends, 2 waiting"), so the badge itself is silent.
      found.badge.setAttribute('aria-hidden', 'true');
      if (count === 0) found.link.removeAttribute('aria-label');
      else setAttr(found.link, 'aria-label', label);
    },
  };
}

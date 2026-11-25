// The shell's tab bar (ADR 0081): a bar along the bottom of a phone held upright, a rail down the
// left beside (any landscape screen, ADR 0067), with the words beside the icons on a desktop. Each
// tab is a link to its screen's URL, so it works as a link does (a new tab, a long press); a plain
// tap moves by the Back rules instead of loading the page. The current tab is marked for screen
// readers (`aria-current="page"`). Each tab holds a badge slot, empty until something waits there.
// It shows on the tab screens alone: `body[data-tabs]` makes room for it (tab-bar.css).
import type { Tab, TabId } from '../app/tabs.ts';
import { element, setAttr, setHidden, setText } from './dom.ts';
import { shapeIcon } from './icons.ts';

export interface TabBar {
  readonly element: HTMLElement;
  /** The tab on show, or none: the bar hides (a fight, a setup, any screen that isn't a tab). */
  show(current: TabId | undefined): void;
  /** What waits in `id` (its badge, none at zero) and the tab's accessible name with it. */
  badge(id: TabId, count: number, label: string): void;
}

/**
 * The game's mark atop the rail (ADR 0087): a ball, and the word on a desktop, where the avatar
 * once sat (it is in each header's lead slot now). The tab bar on a phone leaves it out
 * (tab-bar.css). Decoration: the page's title already names the game.
 */
function railMark(): HTMLElement {
  const mark = element('div', 'tab-bar-mark');
  mark.setAttribute('aria-hidden', 'true');
  const ball = element('img', 'tab-bar-mark-ball');
  ball.src = '/favicon.svg';
  ball.alt = '';
  mark.append(ball, element('span', 'tab-bar-mark-word', 'BallBattle'));
  return mark;
}

function icon(id: TabId): SVGSVGElement {
  return shapeIcon(id, 'tab-bar-icon');
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
  nav.append(railMark(), list);
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

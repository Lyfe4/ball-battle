// Tabs that switch between views of one screen (ADR 0087, polish proposal Part D): the Balls grid and
// the Matchup chart. Not a choice of value, so never the chosen-option look (`.choice`, a ring and a
// check sticker); the view on show is one underline in the primary's yellow. A tab list in the ARIA
// sense: one tab in the tab order (roving), the arrows, Home and End move between them, and each
// controls its panel (`aria-controls`, the panel `role="tabpanel"` labelled by its tab).
import { element, setAttr } from './dom.ts';

export interface ViewTab<T> {
  readonly value: T;
  readonly text: string;
  /** The panel this tab shows. */
  readonly panel: HTMLElement;
}

export interface ViewTabs<T> {
  readonly element: HTMLElement;
  /** Shows `value`'s tab as the current one without calling back (the panels are the caller's). */
  select(value: T): void;
}

export function createViewTabs<T>(
  id: string,
  label: string,
  tabs: readonly ViewTab<T>[],
  initial: T,
  onChange: (value: T) => void,
): ViewTabs<T> {
  const list = element('div', 'view-tabs');
  list.setAttribute('role', 'tablist');
  list.setAttribute('aria-label', label);
  const buttons = tabs.map((tab, index) => {
    const button = element('button', 'view-tab', tab.text);
    button.type = 'button';
    button.id = `${id}-tab-${String(index)}`;
    button.setAttribute('role', 'tab');
    if (tab.panel.id === '') tab.panel.id = `${id}-panel-${String(index)}`;
    button.setAttribute('aria-controls', tab.panel.id);
    tab.panel.setAttribute('role', 'tabpanel');
    tab.panel.setAttribute('aria-labelledby', button.id);
    button.addEventListener('click', () => {
      select(tab.value);
      onChange(tab.value);
    });
    list.append(button);
    return { value: tab.value, button };
  });

  list.addEventListener('keydown', (event) => {
    const at = buttons.findIndex(({ button }) => button === document.activeElement);
    if (at < 0) return;
    const last = buttons.length - 1;
    const to =
      event.key === 'ArrowRight'
        ? (at + 1) % buttons.length
        : event.key === 'ArrowLeft'
          ? (at + last) % buttons.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : undefined;
    if (to === undefined) return;
    event.preventDefault();
    const next = buttons[to];
    if (next === undefined) return;
    next.button.focus();
    select(next.value);
    onChange(next.value);
  });

  function select(current: T): void {
    for (const { value, button } of buttons) {
      const on = value === current;
      setAttr(button, 'aria-selected', String(on));
      button.tabIndex = on ? 0 : -1;
    }
  }
  select(initial);
  return { element: list, select };
}

// The end of a series' main buttons (ADR 0055, 0081): Rematch, the main way on, with what it is
// under it; against the bot Change balls (the same rules, a new lineup) and Home; online Home alone
// beside a Rematch. Each says what it does in a second line; its name is its first.
import { busyOnClick } from '../busy-button.ts';
import { element } from '../dom.ts';

export interface EndButtonActions {
  /** Offline: same lineups, new seed. Online: ask the friend, or say yes (a request). */
  readonly onRematch: () => unknown;
  /** Back to the lineup builder: Change balls against the bot, Home online. */
  readonly onNewSeries: () => void;
  /** Against the bot: Home. */
  readonly onHome?: () => void;
}

/** A button with its name, and what it does under it. */
function twoLine(name: string, sub: string, className: string): HTMLButtonElement {
  const node = element('button', className);
  node.type = 'button';
  node.append(element('span', 'hud-button-label', name), element('span', 'hud-button-sub', sub));
  node.setAttribute('aria-label', name);
  return node;
}

export function createEndButtons(
  online: boolean,
  actions: EndButtonActions,
): {
  readonly rematch: HTMLButtonElement;
  readonly newSeries: HTMLButtonElement;
  readonly home: HTMLButtonElement;
} {
  const rematch = twoLine(
    'Rematch',
    online ? 'Same friend, new lineups' : 'Same balls, new fights',
    'hud-button hud-button-primary',
  );
  busyOnClick(rematch, actions.onRematch);
  // One of the few buttons that tap (sound.ts).
  rematch.dataset['sound'] = 'tap';
  const newSeries = online
    ? element('button', 'hud-button hud-button-primary', 'Home')
    : twoLine('Change balls', 'Same rules, a new lineup', 'hud-button');
  newSeries.type = 'button';
  newSeries.addEventListener('click', actions.onNewSeries);
  const home = element('button', 'hud-button', 'Home');
  home.type = 'button';
  home.addEventListener('click', () => {
    actions.onHome?.();
  });
  return { rematch, newSeries, home };
}

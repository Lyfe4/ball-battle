// An online screen whose code never came (online-lazy.ts): the network dropped as the page started.
// The one failure notice in the screen's place (notice.ts, as an online screen says a failed read),
// with Try again, which asks for the code again and then shows the screen. The Friends tab keeps its
// tab header (no Back, ADR 0081); every other screen has Back. Gone from the page once the code has
// come, so the screens it stood in for are the only ones with their headers.
import type { Screen } from '../app/route.ts';
import { createNotice } from '../ui/notice.ts';
import { element } from '../ui/dom.ts';

export const UNLOADED_TEXT = {
  title: 'Online play didn’t load',
  body: 'Check your connection, then try again. Playing the bot works offline.',
} as const;

export interface Unloaded {
  /** Shows the notice in `screen`'s place. */
  show(screen: Screen): void;
  /** The page laid out for `screen`: the notice shows only on the screen it stands in for. */
  setVisible(screen: Screen): void;
  /** The notice is on show (the online series' screen is then a task's, not a fight's). */
  shown(): boolean;
  /** The code has come: the notice leaves the page. */
  remove(): void;
}

export interface UnloadedHost {
  back(): void;
  /** Asks for the code again and shows the screen once it has come. */
  retry(): Promise<unknown>;
}

interface Made {
  readonly root: HTMLElement;
  show(): void;
}

export function createUnloaded(hud: HTMLElement, host: UnloadedHost): Unloaded {
  /** One section per header kind: a screen's (with Back), or the Friends tab's. */
  const made = new Map<'screen' | 'tab', Made>();
  let standsFor: Screen | undefined;

  function noticeFor(screen: Screen): Made {
    const kind = screen === 'friends' ? 'tab' : 'screen';
    const known = made.get(kind);
    if (known !== undefined) return known;
    const root = element('section', '');
    root.id = `online-unloaded-${kind}`;
    root.setAttribute('aria-label', 'Online play');
    root.hidden = true;
    hud.insertBefore(root, hud.querySelector('#hud-status'));
    const notice = createNotice(
      root,
      () => {
        host.back();
      },
      kind === 'tab' ? { tab: 'friends' } : {},
    );
    const one: Made = {
      root,
      show: () => {
        notice.show({
          title: UNLOADED_TEXT.title,
          body: [UNLOADED_TEXT.body],
          buttons: [{ text: 'Try again', onClick: () => host.retry() }],
        });
      },
    };
    made.set(kind, one);
    return one;
  }

  const hideAll = () => {
    for (const { root } of made.values()) root.hidden = true;
  };

  return {
    show(screen) {
      hideAll();
      standsFor = screen;
      const notice = noticeFor(screen);
      notice.root.hidden = false;
      notice.show();
    },
    setVisible(screen) {
      if (screen !== standsFor) hideAll();
    },
    shown: () => [...made.values()].some(({ root }) => !root.hidden),
    remove() {
      for (const { root } of made.values()) root.remove();
      made.clear();
      standsFor = undefined;
    },
  };
}

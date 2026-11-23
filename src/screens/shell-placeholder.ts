// The shell's screens (ADR 0081) before their own pull requests: Friends, Profile and Ranks, one
// notice in the shared look (notice.ts) with Back and one way on. Reached only by their URLs until
// the tab bar links them (the build plan's PR 3).
import type { Moves } from '../app/moves.ts';
import { writeSendParams, writeSignInParams } from '../app/online-url.ts';
import { SHELL_VIEWS, type ShellView } from '../app/route.ts';
import type { ScreenHandler } from '../app/router.ts';
import type { Screen } from '../app/route.ts';
import { createNotice } from '../ui/notice.ts';
import { PLACEHOLDERS, type PlaceholderWay } from './shell-placeholder-text.ts';

export interface ShellPlaceholderHost {
  /** Back: the screen it was opened from, else Play in its place. */
  readonly back: () => void;
  /** Where a placeholder's button leads. */
  readonly open: (way: PlaceholderWay) => void;
}

export interface ShellPlaceholder {
  setVisible(visible: boolean): void;
  show(view: ShellView): void;
}

export function createShellPlaceholder(
  root: HTMLElement,
  host: ShellPlaceholderHost,
): ShellPlaceholder {
  const notice = createNotice(root, host.back);
  return {
    setVisible(visible) {
      root.hidden = !visible;
    },
    show(view) {
      const text = PLACEHOLDERS[view];
      root.setAttribute('aria-label', text.title);
      notice.show({
        title: text.title,
        body: [text.body],
        buttons: [
          {
            text: text.button,
            onClick: () => {
              host.open(text.to);
            },
          },
        ],
      });
    },
  };
}

export type ShellScreensHost = Pick<Moves, 'go' | 'goHome' | 'backOrHome'>;

export interface ShellScreens {
  readonly handlers: { readonly [S in ShellView]: ScreenHandler<S> };
  /** Shows the placeholder on its own screens, hides it on every other. */
  setVisible(screen: Screen): void;
}

/** The placeholder wired to the page: Back by the rules (ADR 0025), each button to its screen. */
export function mountShell(root: HTMLElement, host: ShellScreensHost): ShellScreens {
  const screen = createShellPlaceholder(root, {
    back: host.backOrHome,
    open: (way) => {
      if (way === 'home') host.goHome();
      else if (way === 'send') {
        host.go((url) => {
          writeSendParams(url, 'reveal', 3);
        });
      } else host.go(writeSignInParams);
    },
  });
  const handler = (view: ShellView) => ({
    show: () => {
      screen.show(view);
    },
  });
  return {
    handlers: { friends: handler('friends'), profile: handler('profile'), ranks: handler('ranks') },
    setVisible(current) {
      screen.setVisible(SHELL_VIEWS.some((view) => view === current));
    },
  };
}

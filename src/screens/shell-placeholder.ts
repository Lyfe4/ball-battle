// The shell's screens (ADR 0081) before their own pull requests: Friends, Profile and Ranks, one
// notice in the shared look (notice.ts) with Back and one way on. The tab bar links Friends and
// Ranks (shell.ts); Profile is reached by its URL until the avatar opens it.
import type { ShellView } from '../app/route.ts';
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

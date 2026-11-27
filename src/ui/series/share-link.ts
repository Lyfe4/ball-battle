// The end of a series against the bot: "Copy link", the finished series' address (already in the
// address bar) to the clipboard, saying what happened. Online series are on the server and the
// guided first series has nobody to send it to yet (ADR 0090), so neither shows it.
import { element, setHidden, setText } from '../dom.ts';

const COPY = 'Copy link';

export interface ShareLink {
  readonly element: HTMLButtonElement;
  /** Shown at a finished series' result only; back to its first words otherwise. */
  show(shown: boolean): void;
}

export function createShareLink(): ShareLink {
  const share = element('button', 'hud-button series-share', COPY);
  share.type = 'button';
  share.addEventListener('click', () => {
    // No clipboard (an insecure context has none at all, or it was refused): the address bar
    // still holds the link. Asked as a promise either way, so a missing clipboard never throws.
    const clipboard = navigator.clipboard as Clipboard | undefined;
    const copied =
      clipboard === undefined
        ? Promise.reject(new Error('No clipboard'))
        : clipboard.writeText(window.location.href);
    void copied.then(
      () => {
        setText(share, 'Link copied');
      },
      () => {
        setText(share, 'Copy the address bar to share');
      },
    );
  });
  return {
    element: share,
    show(shown) {
      setHidden(share, !shown);
      if (!shown) setText(share, COPY);
    },
  };
}

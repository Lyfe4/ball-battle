import { createNotice } from './notice.ts';
import { outdatedText, type OutdatedLink } from './outdated-text.ts';

export interface OutdatedActions {
  readonly onBack: () => void;
  /** Play the link under this page's rules. */
  readonly onPlay: () => void;
  /** A newer link: reload the page to get the version that made it. */
  readonly onReload: () => void;
}

export interface OutdatedScreen {
  setVisible(visible: boolean): void;
  /** Shows the notice for this link and moves focus to its heading. */
  show(link: OutdatedLink): void;
}

/**
 * One job: say why a shared link won't replay as it was, and offer to play it anyway. An older
 * link plays under today's rules; a newer one (an old page, cached) offers a reload first.
 */
export function createOutdatedScreen(root: HTMLElement, actions: OutdatedActions): OutdatedScreen {
  const notice = createNotice(root, actions.onBack);
  return {
    setVisible(visible) {
      root.hidden = !visible;
    },
    show(link) {
      const text = outdatedText(link);
      const play = { text: text.play, onClick: actions.onPlay };
      notice.show({
        title: text.title,
        body: [text.body],
        buttons: link.newer ? [{ text: 'Reload', onClick: actions.onReload }, play] : [play],
      });
    },
  };
}

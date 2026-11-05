import { element } from './dom.ts';
import { outdatedText, type OutdatedLink } from './outdated-text.ts';
import { createScreenHeader } from './screen-header.ts';

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
  const header = createScreenHeader('', 'Back', actions.onBack);
  const body = element('p', 'outdated-body');
  const play = element('button', 'hud-button');
  play.type = 'button';
  play.addEventListener('click', actions.onPlay);
  const reload = element('button', 'hud-button hud-button-primary', 'Reload');
  reload.type = 'button';
  reload.addEventListener('click', actions.onReload);
  const footer = element('div', 'screen-footer');
  root.classList.add('outdated');
  root.replaceChildren(header.element, body, footer);

  return {
    setVisible(visible) {
      root.hidden = !visible;
    },
    show(link) {
      const text = outdatedText(link);
      header.setTitle(text.title);
      body.textContent = text.body;
      play.textContent = text.play;
      play.classList.toggle('hud-button-primary', !link.newer);
      footer.replaceChildren(...(link.newer ? [reload, play] : [play]));
      header.focus();
    },
  };
}

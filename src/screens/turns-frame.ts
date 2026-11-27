// A series by turns, between its fights, sits in the page frame like every screen where nothing
// fights (ADR 0087; the 2026-11-27 staging walk found it bare: no Back, no title, and no rail on a
// PC). The header row (Back, what is played, the legend's ?, the gear last) tops the series panel,
// whose own bar (the fight screen's ? and gear) steps aside, so the screen still has one gear and
// one ?. While one of its rounds is fought the arena takes over, as in every fight: the row goes.
// A live match is a fight throughout and never framed (its clock and Leave are the fight's).
import type { SeriesView } from '../api/series.ts';
import { setAttr, setHidden, setText } from '../ui/dom.ts';
import { createScreenHeader } from '../ui/screen-header.ts';
import { challengeLine } from './online-text.ts';

const TITLE_ID = 'turns-title';

export interface TurnsFrame {
  /**
   * Frames the panel for `view` (by turns, nothing fought), or lets the fight have the screen.
   * Returns whether that changed (the shell's kind follows it).
   */
  show(view: SeriesView | undefined, framed: boolean): boolean;
  /** The panel is framed now: the shell keeps the rail (a task, `shellOf`). */
  framed(): boolean;
}

export function createTurnsFrame(panel: HTMLElement, back: () => void): TurnsFrame {
  const header = createScreenHeader('', 'Back', back, { legend: true });
  header.element.classList.add('turns-head');
  header.element.querySelector('.screen-title')?.setAttribute('id', TITLE_ID);
  header.element.hidden = true;
  panel.prepend(header.element);
  /** The panel's own heading, which names it while it is a fight's. */
  const own = panel.getAttribute('aria-labelledby') ?? '';
  let on = false;
  return {
    show(view, framed) {
      const was = on;
      on = framed && view !== undefined;
      setHidden(header.element, !on);
      panel.toggleAttribute('data-framed', on);
      setAttr(panel, 'aria-labelledby', on ? TITLE_ID : own);
      if (on && view !== undefined) {
        const title = header.element.querySelector<HTMLElement>('.screen-title-phone');
        if (title !== null) setText(title, challengeLine(view));
      }
      return on !== was;
    },
    framed: () => on,
  };
}

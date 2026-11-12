import { element } from '../dom.ts';

export interface LeaveConfirm {
  /** The way out: the Leave series link, or the confirm row in its place. */
  readonly element: HTMLElement;
  /** Shows or hides the way out (hidden at the result). Hiding it also closes the confirm. */
  setHidden(hidden: boolean): void;
  /** Back to the plain Leave series link, without leaving. */
  close(): void;
}

/**
 * Leave series, asked once (ADR 0042): leaving forgets the series, so a tap on the link turns its
 * row into the question with Stay and Leave under it. No modal: the fight goes on behind it. Stay is
 * the default (first, primary, focused, and Escape means Stay); only Leave leaves.
 */
export function createLeaveConfirm(onLeave: () => void): LeaveConfirm {
  const root = element('div', 'leave-confirm');
  const link = element('button', 'text-link series-leave', 'Leave series');
  link.type = 'button';

  const row = element('div', 'leave-confirm-row');
  row.setAttribute('role', 'group');
  const question = element('p', 'leave-confirm-question', 'Leave? You’ll lose this series');
  question.id = 'leave-confirm-question';
  row.setAttribute('aria-labelledby', question.id);
  const leave = element('button', 'hud-button leave-confirm-leave', 'Leave');
  leave.type = 'button';
  const stay = element('button', 'hud-button hud-button-primary leave-confirm-stay', 'Stay');
  stay.type = 'button';
  const buttons = element('div', 'leave-confirm-buttons');
  buttons.append(stay, leave);
  row.append(question, buttons);
  row.hidden = true;
  root.append(link, row);

  /** Escape only ever closes things (ADR 0038): here it means Stay. */
  function onKey(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    close(true);
  }

  function open(): void {
    link.hidden = true;
    row.hidden = false;
    document.addEventListener('keydown', onKey);
    stay.focus({ preventScroll: true });
  }

  function close(refocus: boolean): void {
    if (row.hidden) return;
    row.hidden = true;
    link.hidden = false;
    document.removeEventListener('keydown', onKey);
    if (refocus) link.focus({ preventScroll: true });
  }

  link.addEventListener('click', open);
  stay.addEventListener('click', () => {
    close(true);
  });
  leave.addEventListener('click', () => {
    close(false);
    onLeave();
  });

  return {
    element: root,
    setHidden(hidden) {
      if (hidden) close(false);
      root.hidden = hidden;
    },
    close() {
      close(false);
    },
  };
}

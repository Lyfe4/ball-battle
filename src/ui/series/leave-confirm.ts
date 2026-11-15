import { busyOnClick } from '../busy-button.ts';
import { element, setHidden, setText } from '../dom.ts';

export interface LeaveConfirm {
  /** The way out: the Leave series link, or the confirm row in its place. */
  readonly element: HTMLElement;
  /** Shows or hides the way out (hidden at the result). Hiding it also closes the confirm. */
  setHidden(hidden: boolean): void;
  /** Back to the plain Leave series link, without leaving. */
  close(): void;
  /**
   * A live match (ADR 0053): "Leave match", asked as "Leave and forfeit?", since leaving loses it.
   * Otherwise as made.
   */
  setLive(live: boolean): void;
}

/**
 * Leave series, asked once (ADR 0042), unless `ask` is false (an online series, which leaving
 * keeps): leaving forgets the series, so a tap on the link turns its
 * row into the question with Stay and Leave under it. No modal: the fight goes on behind it. Stay is
 * the default (first, primary, focused, and Escape means Stay); only Leave leaves.
 */
export function createLeaveConfirm(onLeave: () => unknown, ask = true): LeaveConfirm {
  const root = element('div', 'leave-confirm');
  const link = element('button', 'text-link series-leave', ask ? 'Leave series' : 'Home');
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

  // Online (ADR 0052) leaving keeps the series on the server: nothing to ask.
  let asks = ask;
  const words = { link: link.textContent, question: question.textContent };
  link.addEventListener('click', () => {
    if (asks) open();
    else onLeave();
  });
  stay.addEventListener('click', () => {
    close(true);
  });
  // A live match's Leave and forfeit is a request: the question stays, its Leave working, until
  // it is done (busy-button.ts).
  busyOnClick(leave, () => {
    const out = onLeave();
    if (out instanceof Promise) {
      return out.finally(() => {
        close(false);
      });
    }
    close(false);
    return undefined;
  });

  return {
    element: root,
    setHidden(hidden) {
      if (hidden) close(false);
      setHidden(root, hidden);
    },
    close() {
      close(false);
    },
    setLive(live) {
      asks = live || ask;
      setText(link, live ? 'Leave match' : words.link);
      setText(question, live ? 'Leave and forfeit?' : words.question);
    },
  };
}

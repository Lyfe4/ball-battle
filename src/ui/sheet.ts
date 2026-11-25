// The sheet (ADR 0086, social S 4; ADR 0087): one component for every modal sheet, What to play first,
// the friend sheet next. A modal dialog, along the bottom on a phone held upright and a panel in the
// middle beside and on a desktop (sheet.css). Its head is the header row's geometry: the title, then
// the shared × last (one close per overlay, close-button.ts); Escape and a tap outside close it too,
// and a screen closes it on Back (the Play tab does, home.ts). Focus goes to the title as it opens
// (tabindex -1: a screen reader hears the sheet's name, and Tab reaches its first control) and back
// to what opened it as it closes. A destructive action goes through its confirm step: what it does
// in words, the action in the danger look and Cancel, which is the default and has focus.
import { createCloseButton } from './close-button.ts';
import { element, setHidden } from './dom.ts';

export interface SheetOptions {
  /** The id of the sheet's title (its accessible name). */
  readonly id: string;
  readonly title: string;
  /** Classes the sheet's parts also wear: `<name>`, `<name>-body`, `<name>-head`, `<name>-title`. */
  readonly name?: string;
  /** It closed, by any way out (after focus went back to what opened it). */
  readonly onClosed?: () => void;
}

export interface ConfirmStep {
  readonly title: string;
  /** What the action does, in a sentence. */
  readonly text: string;
  /** The action's words ("Remove", "Block"). */
  readonly action: string;
  readonly cancel?: string;
}

export interface Sheet {
  readonly element: HTMLDialogElement;
  /** Where the sheet's own content goes, under its head. */
  readonly content: HTMLElement;
  readonly title: HTMLElement;
  readonly isOpen: () => boolean;
  /** Opens it (modal), focus on its title. */
  open(): void;
  /** Closes it, if open. */
  close(): void;
  /**
   * Asks before a destructive action, in the sheet's place: true when the player confirms, false on
   * Cancel or any close. The content comes back after.
   */
  confirm(step: ConfirmStep): Promise<boolean>;
}

export function createSheet(options: SheetOptions): Sheet {
  const also = (part: string) => (options.name === undefined ? '' : ` ${options.name}${part}`);
  const dialog = element('dialog', `sheet${also('')}`);
  const title = element('h2', `sheet-title${also('-title')}`, options.title);
  title.id = options.id;
  title.tabIndex = -1;
  dialog.setAttribute('aria-labelledby', title.id);
  const head = element('div', `sheet-head${also('-head')}`);
  head.append(
    title,
    createCloseButton(() => {
      dialog.close();
    }),
  );
  const content = element('div', 'sheet-content');

  // The confirm step, in place of the content while it asks.
  const confirmView = element('div', 'sheet-confirm');
  confirmView.hidden = true;
  const confirmText = element('p', 'sheet-confirm-text');
  const confirmActions = element('div', 'sheet-confirm-actions');
  const cancelButton = element('button', 'hud-button sheet-confirm-cancel');
  cancelButton.type = 'button';
  cancelButton.dataset['sound'] = 'back';
  const actionButton = element('button', 'hud-button danger-button sheet-confirm-action');
  actionButton.type = 'button';
  confirmActions.append(actionButton, cancelButton);
  confirmView.append(confirmText, confirmActions);

  const body = element('div', `sheet-body${also('-body')}`);
  body.append(head, content, confirmView);
  dialog.append(body);

  let opener: HTMLElement | undefined;
  let answer: ((confirmed: boolean) => void) | undefined;
  let titleBefore = options.title;

  /** Answers the confirm step that is asking, if one is, and brings the content back. */
  function settle(confirmed: boolean): void {
    const resolve = answer;
    if (resolve === undefined) return;
    answer = undefined;
    setHidden(confirmView, true);
    setHidden(content, false);
    title.textContent = titleBefore;
    resolve(confirmed);
  }

  cancelButton.addEventListener('click', () => {
    settle(false);
    title.focus();
  });
  actionButton.addEventListener('click', () => {
    settle(true);
  });

  // A tap on the backdrop lands on the dialog itself: its body fills the box, so it is outside.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    settle(false);
    const back = opener;
    opener = undefined;
    if (back?.isConnected === true) back.focus();
    options.onClosed?.();
  });

  return {
    element: dialog,
    content,
    title,
    isOpen: () => dialog.open,
    open() {
      if (!dialog.open) {
        const active = document.activeElement;
        opener = active instanceof HTMLElement && !dialog.contains(active) ? active : undefined;
        dialog.showModal();
      }
      title.focus();
    },
    close() {
      if (dialog.open) dialog.close();
    },
    confirm(step) {
      settle(false);
      titleBefore = title.textContent;
      title.textContent = step.title;
      confirmText.textContent = step.text;
      actionButton.textContent = step.action;
      cancelButton.textContent = step.cancel ?? 'Cancel';
      setHidden(content, true);
      setHidden(confirmView, false);
      // Cancel is the safe default (ADR 0086): Enter or Space right away does nothing destructive.
      cancelButton.focus();
      return new Promise((resolve) => {
        answer = resolve;
      });
    },
  };
}

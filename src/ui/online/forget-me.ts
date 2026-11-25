// "Forget me" in settings (ADR 0052 sections 2 and 6): shown only on a device that has a guest. It
// deletes the guest on the server at once (its open series are forfeited, finished ones stay in
// the opponent's history as "Deleted player") and clears every `ballbattle.*` key here. Asked once,
// in place, like Leave series. Only in builds without accounts (ADR 0078): with them, the account
// screen holds Forget me, Log out and Delete account (ADR 0079 addendum of 2026-11-22).
import { busyOnClick } from '../busy-button.ts';
import { element, setText } from '../dom.ts';

export interface ForgetMe {
  readonly element: HTMLElement;
  /** Shows the group only when this device has a guest. */
  refresh(): void;
}

export interface ForgetMeHost {
  hasGuest(): boolean;
  /**
   * Deletes the guest and this device's keys; resolves undefined when done, else the line that says
   * why not (offline, the server too slow or failing).
   */
  forget(): Promise<string | undefined>;
}

export function createForgetMe(host: ForgetMeHost): ForgetMe {
  const group = element('div', 'settings-group settings-online');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-labelledby', 'settings-online-title');
  const heading = element('p', 'settings-heading', 'Online');
  heading.id = 'settings-online-title';
  const line = element('p', 'settings-online-line', 'This device plays online as a guest.');
  const start = element('button', 'hud-button danger-button settings-forget', 'Forget me');
  start.type = 'button';
  const confirm = element('div', 'settings-forget-confirm');
  const question = element(
    'p',
    'settings-online-line',
    'Delete your guest? A match in play is lost; finished ones stay, as “Deleted player”.',
  );
  const yes = element('button', 'hud-button', 'Delete');
  yes.type = 'button';
  const no = element('button', 'hud-button hud-button-primary', 'Keep');
  no.type = 'button';
  confirm.append(question, no, yes);
  confirm.hidden = true;
  group.append(heading, line, start, confirm);

  start.addEventListener('click', () => {
    start.hidden = true;
    confirm.hidden = false;
    no.focus();
  });
  no.addEventListener('click', () => {
    confirm.hidden = true;
    start.hidden = false;
    start.focus();
  });
  busyOnClick(yes, () =>
    host.forget().then((failed) => {
      // Done, the page starts afresh; otherwise the line says why not, and Delete can be tapped again.
      if (failed !== undefined) setText(question, failed);
    }),
  );

  return {
    element: group,
    refresh() {
      const guest = host.hasGuest();
      group.hidden = !guest;
      start.hidden = !guest || !confirm.hidden;
    },
  };
}

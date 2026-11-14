// "Forget me" in settings (ADR 0052 sections 2 and 6): shown only on a device that has a guest. It
// deletes the guest on the server at once (its open series are forfeited, finished ones stay in
// the opponent's history as "Deleted player") and clears every `ballbattle.*` key here. Asked once,
// in place, like Leave series.
import { element, setText } from '../dom.ts';

export interface ForgetMe {
  readonly element: HTMLElement;
  /** Shows the group only when this device has a guest. */
  refresh(): void;
}

export interface ForgetMeHost {
  hasGuest(): boolean;
  /** Deletes the guest and this device's keys; resolves false when the server couldn't be reached. */
  forget(): Promise<boolean>;
}

export function createForgetMe(host: ForgetMeHost): ForgetMe {
  const group = element('div', 'settings-group settings-online');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-labelledby', 'settings-online-title');
  const heading = element('p', 'settings-heading', 'Online');
  heading.id = 'settings-online-title';
  const line = element('p', 'settings-online-line', 'This device plays online as a guest.');
  const start = element('button', 'text-link settings-forget', 'Forget me');
  start.type = 'button';
  const confirm = element('div', 'settings-forget-confirm');
  const question = element(
    'p',
    'settings-online-line',
    'Delete your guest and its games? Open series are lost.',
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
  yes.addEventListener('click', () => {
    yes.disabled = true;
    void host.forget().then((done) => {
      yes.disabled = false;
      if (!done) setText(question, 'You’re offline: try again when you’re back.');
    });
  });

  return {
    element: group,
    refresh() {
      group.hidden = !host.hasGuest();
    },
  };
}

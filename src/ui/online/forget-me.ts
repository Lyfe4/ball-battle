// "Forget me" in settings (ADR 0052 sections 2 and 6): shown only on a device that has a guest. It
// deletes the guest on the server at once (its open series are forfeited, finished ones stay in
// the opponent's history as "Deleted player") and clears every `ballbattle.*` key here. Asked once,
// in place, like Leave series. For an account (ADR 0079) the same is Delete account, beside Your
// account (its username) and Log out, which asks nothing: signing back in undoes it.
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
   * Builds with accounts (ADR 0079): whether this device is signed in, and the way to the sign-in
   * screen, which the group then offers to every device that isn't.
   */
  readonly hasAccount?: () => boolean;
  readonly signIn?: () => void;
  /** Logs this device's account out; resolves like `forget`. */
  readonly logOut?: () => Promise<string | undefined>;
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
  const start = element('button', 'text-link settings-forget', 'Forget me');
  start.type = 'button';
  const signIn = element('button', 'text-link settings-sign-in', 'Sign in');
  signIn.type = 'button';
  signIn.hidden = true;
  const offerSignIn = host.signIn;
  if (offerSignIn !== undefined) {
    signIn.addEventListener('click', () => {
      offerSignIn();
    });
  }
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
  const logOut = element('button', 'text-link settings-log-out', 'Log out');
  logOut.type = 'button';
  logOut.hidden = true;
  const offerLogOut = host.logOut;
  if (offerLogOut !== undefined) {
    busyOnClick(logOut, () =>
      offerLogOut().then((failed) => {
        if (failed !== undefined) setText(line, failed);
      }),
    );
  }
  group.append(heading, line, signIn, logOut, start, confirm);

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
      const account = host.hasAccount?.() ?? false;
      const offers = host.signIn !== undefined;
      group.hidden = !guest && !offers;
      signIn.hidden = !offers;
      setText(signIn, account ? 'Your account' : 'Sign in');
      logOut.hidden = !account || host.logOut === undefined;
      start.hidden = !guest || !confirm.hidden;
      setText(start, account ? 'Delete account' : 'Forget me');
      setText(
        line,
        account
          ? 'This device is signed in to your account.'
          : guest
            ? 'This device plays online as a guest.'
            : 'Sign in to keep your games on any device.',
      );
      setText(
        question,
        account
          ? 'Delete your account? Its username and games go with it. A match in play is lost; ' +
              'finished ones stay in opponents’ history, as “Deleted player”.'
          : 'Delete your guest? A match in play is lost; finished ones stay, as “Deleted player”.',
      );
    },
  };
}

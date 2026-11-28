// The check before a device's first email code (ADR 0079 addendum of 2026-11-28), as the sign-in
// screen sees it: a box reserved at the widget's size under the email field, and a token when the
// player sends. The widget itself (Cloudflare Turnstile, `turnstile.ts`) is fetched the first time
// the box shows; this file never names it, so a fake widget tests every state.

/** What the code step asks of the check. */
export interface Captcha {
  /** The box the widget sits in: the ways-in card's part, the same element every time. */
  readonly element: HTMLElement;
  /** The box is on screen (again): render the widget in it, loading it the first time. */
  show(): void;
  /**
   * A token for one send, waiting for the widget if it is still checking; undefined when it
   * failed (not loaded, or Cloudflare refused this browser) or took longer than TOKEN_WAIT_MS.
   * The token is spent: the next send waits for a new one.
   */
  token(): Promise<string | undefined>;
}

/** One rendered widget, as `turnstile.ts` makes it. */
export interface CaptchaWidget {
  /** Renders it in the box afresh: the box was just put on screen. */
  render(): void;
  /** Asks for a new token, the last one spent. */
  reset(): void;
}

/** What a widget tells the check. */
export interface CaptchaEvents {
  readonly token: (token: string) => void;
  readonly expired: () => void;
  readonly failed: () => void;
}

/** Makes the widget in `box` (loading Cloudflare's script); rejects if it can't. */
export type WidgetMaker = (box: HTMLElement, events: CaptchaEvents) => Promise<CaptchaWidget>;

/**
 * Longest a send waits for a token: a check that needs the player (Cloudflare's own checkbox)
 * gets this long to be ticked while the button shows it is busy.
 */
export const TOKEN_WAIT_MS = 60_000;

export function createCaptcha(make: WidgetMaker, wait = TOKEN_WAIT_MS): Captcha {
  const element = document.createElement('div');
  element.className = 'sign-in-captcha';
  let widget: Promise<CaptchaWidget | undefined> | undefined;
  let current: string | undefined;
  let failed = false;
  let waiting: ((token: string | undefined) => void)[] = [];

  const settle = (token: string | undefined) => {
    const done = waiting;
    waiting = [];
    for (const resolve of done) resolve(token);
  };
  const events: CaptchaEvents = {
    token(token) {
      failed = false;
      if (waiting.length > 0) settle(token);
      else current = token;
    },
    expired() {
      current = undefined;
    },
    failed() {
      failed = true;
      current = undefined;
      settle(undefined);
    },
  };

  function show(): void {
    current = undefined;
    failed = false;
    if (widget === undefined) {
      widget = make(element, events).then(
        (made) => {
          made.render();
          return made;
        },
        () => {
          // Not loaded (offline, blocked): a send says so, and the next show tries again.
          widget = undefined;
          events.failed();
          return undefined;
        },
      );
    } else {
      void widget.then((made) => {
        made?.render();
      });
    }
  }

  async function token(): Promise<string | undefined> {
    if (widget === undefined || failed) return undefined;
    const made = await widget;
    if (made === undefined) return undefined;
    let got = current;
    current = undefined;
    got ??= await new Promise<string | undefined>((resolve) => {
      waiting.push(resolve);
      window.setTimeout(() => {
        waiting = waiting.filter((one) => one !== resolve);
        resolve(undefined);
      }, wait);
    });
    // Spent or not, the next send needs a token of its own.
    made.reset();
    return got;
  }

  return { element, show, token };
}

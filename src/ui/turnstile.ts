// Cloudflare Turnstile's widget on the sign-in screen (ADR 0079 addendum of 2026-11-28), its own
// chunk: fetched only when the email field shows in a build with a site key (`captcha-build.ts`), never
// on the first load. Its script is Cloudflare's and comes from Cloudflare (the CSP names it); the
// page's CSP requires Trusted Types, so the script's URL is made by a policy of our own that makes
// that one URL and nothing else. Measured 2026-11-28 under the production CSP in Chromium, Firefox
// and WebKit: no violation (scripts/turnstile-probe.ts).
import { CAPTCHA_ACTION } from '../api/accounts.ts';
import type { CaptchaWidget } from './captcha.ts';

export const TURNSTILE_SCRIPT =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** What the page uses of Cloudflare's `window.turnstile`. */
export interface TurnstileApi {
  render(container: HTMLElement, options: Readonly<Record<string, unknown>>): string | undefined;
  reset(id: string): void;
  remove(id: string): void;
}

interface TurnstileWindow {
  turnstile?: TurnstileApi;
  trustedTypes?: {
    createPolicy(
      name: string,
      rules: { createScriptURL: (url: string) => string },
    ): { createScriptURL(url: string): unknown };
  };
}

let loading: Promise<TurnstileApi> | undefined;

/** Cloudflare's script, once a page: the same promise for every widget after it. */
export function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const page = window as unknown as TurnstileWindow;
    const script = document.createElement('script');
    const policy = page.trustedTypes?.createPolicy('turnstile', {
      createScriptURL: (url) => {
        if (url !== TURNSTILE_SCRIPT) throw new TypeError('Only Turnstile’s script');
        return url;
      },
    });
    // A browser without Trusted Types enforces none: the plain URL is the same one.
    script.src = (policy?.createScriptURL(TURNSTILE_SCRIPT) ?? TURNSTILE_SCRIPT) as string;
    script.async = true;
    script.addEventListener('load', () => {
      if (page.turnstile === undefined) reject(new Error('Turnstile loaded without its API'));
      else resolve(page.turnstile);
    });
    script.addEventListener('error', () => {
      // Offline, or blocked: the next widget asks again.
      loading = undefined;
      script.remove();
      reject(new Error('Turnstile’s script did not load'));
    });
    document.head.append(script);
  });
  return loading;
}

/**
 * The widget in `box`, rendered afresh each time the box is shown again (a notice moves its parts,
 * which reloads a frame). Each token is single-use: `reset` asks Cloudflare for the next one.
 */
export function createTurnstile(
  box: HTMLElement,
  siteKey: string,
  api: TurnstileApi,
  events: {
    readonly token: (token: string) => void;
    readonly expired: () => void;
    readonly failed: () => void;
  },
): CaptchaWidget {
  let id: string | undefined;
  return {
    render() {
      if (id !== undefined) api.remove(id);
      id = api.render(box, {
        sitekey: siteKey,
        action: CAPTCHA_ACTION,
        theme: 'auto',
        size: 'flexible',
        appearance: 'always',
        'response-field': false,
        'refresh-expired': 'auto',
        callback: events.token,
        'expired-callback': events.expired,
        'timeout-callback': events.expired,
        'error-callback': () => {
          events.failed();
          // Handled: Cloudflare's widget says what went wrong in its own words, and retries.
          return true;
        },
      });
    },
    reset() {
      if (id !== undefined) api.reset(id);
    },
  };
}

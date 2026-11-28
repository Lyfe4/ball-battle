// Whether this build checks a device's first email code with Cloudflare Turnstile (ADR 0079
// addendum of 2026-11-28): only with accounts, and only where `VITE_TURNSTILE_SITE_KEY` is set
// (production builds it from `BALLBATTLE_TURNSTILE_SITE_KEY`, netlify.toml; the functions check
// only with that key and `TURNSTILE_SECRET_KEY` both set). Vite writes the value in, so without it
// the widget and its chunk are left out of the bundle (`scripts/check-bundle.ts`, CAPTCHA_MARK).
import { createCaptcha, type Captcha } from '../ui/captcha.ts';

/** The sign-in screen's check, or undefined in a build without a site key: nothing changes. */
export function captchaFor(): Captcha | undefined {
  // Written out, not through ACCOUNTS_BUILD: the bundler drops the dynamic import (and its chunk)
  // only behind a condition it can read here.
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  if (
    import.meta.env.VITE_ONLINE === '1' &&
    import.meta.env.VITE_ACCOUNTS === '1' &&
    siteKey !== undefined &&
    siteKey !== ''
  ) {
    return createCaptcha(async (box, events) => {
      const { loadTurnstile, createTurnstile } = await import('../ui/turnstile.ts');
      return createTurnstile(box, siteKey, await loadTurnstile(), events);
    });
  }
  return undefined;
}

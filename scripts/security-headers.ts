// Security headers for the production site. Netlify serves them from netlify.toml; `vite preview`
// serves the same set (vite.config.ts) so the CSP can be checked against a real production build
// before deploying. security-headers.test.ts keeps netlify.toml in step with this file.

/**
 * The Realtime poke's sockets (ADR 0082): staging's and production's Supabase projects
 * (`scripts/supabase-projects.ts`, a test keeps them in step), `wss:` only, since the page never
 * calls Supabase over HTTPS. Named in full: older Safari doesn't count `wss:` as `'self'`, and one
 * CSP serves every context, so both are listed.
 */
export const REALTIME_ORIGINS: readonly string[] = [
  'wss://fcmzgitzaaabcmbzxxcg.supabase.co',
  'wss://wtqmptuhonbtjwxjwtwl.supabase.co',
];

/**
 * Cloudflare Turnstile (ADR 0079 addendum of 2026-11-28): its script and the frame it draws, on the
 * sign-in screen's email step only, and only in a build with a site key (`src/ui/turnstile.ts`; a
 * build without one holds no such URL, `check-bundle.ts`). The CSP is one static header for every
 * context, so it is named here whether or not a deploy has the key. Measured under this policy in
 * Chromium, Firefox and WebKit with Cloudflare's test keys, Trusted Types on: no violation, nothing
 * else needed (`scripts/turnstile-probe.ts`). Its script URL is made by a policy of our own.
 */
export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

/** The local stack's Realtime (`supabase start`): `pnpm preview` only, never shipped. */
export const LOCAL_REALTIME = 'ws://127.0.0.1:54321';

/**
 * Everything the built app loads comes from its own origin: one module script, one stylesheet and
 * the self-hosted font files from /assets, the icons and the web app manifest; the network calls
 * are to the game's own API on the same origin (ADR 0052, `connect-src 'self'`) and Realtime's
 * socket for the poke (ADR 0082). The one exception is Turnstile's script and frame, where a build
 * checks a first email code (TURNSTILE_ORIGIN). Trusted
 * Types are required, so no string can ever reach an HTML or script sink: the game builds its DOM
 * with createElement and textContent only. Nothing else is allowed. Inline styles set through the CSSOM (element.style) are
 * not subject to CSP, so the HUD and canvas sizing keep working under style-src 'self'.
 */
const policyWith = (connect: readonly string[]): string =>
  [
    "default-src 'none'",
    `script-src 'self' ${TURNSTILE_ORIGIN}`,
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    "manifest-src 'self'",
    ['connect-src', "'self'", ...connect].join(' '),
    `frame-src ${TURNSTILE_ORIGIN}`,
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "require-trusted-types-for 'script'",
  ].join('; ');

export const CONTENT_SECURITY_POLICY = policyWith(REALTIME_ORIGINS);

/**
 * Paths that override a site-wide header. The link-preview image is fetched by other sites: a chat
 * client that shows the preview by loading the image straight from this origin in its own page is
 * refused it under `same-origin`. Only netlify.toml serves this (vite preview applies the site-wide
 * set to every file).
 */
export const PATH_HEADERS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  '/og-image.png': { 'Cross-Origin-Resource-Policy': 'cross-origin' },
};

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  // HTTPS only, for two years, set by us rather than left to the platform (ADR 0052 section 6).
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy':
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

/**
 * What `pnpm preview` serves: the production set, with the local stack's Realtime added to
 * `connect-src` so a local build's socket can be checked under the real CSP. netlify.toml never
 * holds it (security-headers.test.ts).
 */
export const LOCAL_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  ...SECURITY_HEADERS,
  'Content-Security-Policy': policyWith([...REALTIME_ORIGINS, LOCAL_REALTIME]),
};

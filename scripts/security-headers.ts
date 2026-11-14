// Security headers for the production site. Netlify serves them from netlify.toml; `vite preview`
// serves the same set (vite.config.ts) so the CSP can be checked against a real production build
// before deploying. security-headers.test.ts keeps netlify.toml in step with this file.

/**
 * Everything the built app loads comes from its own origin: one module script, one stylesheet and
 * the self-hosted font files from /assets, the icons and the web app manifest; the only network
 * calls are to the game's own API on the same origin (ADR 0052, `connect-src 'self'`). Trusted
 * Types are required, so no string can ever reach an HTML or script sink: the game builds its DOM
 * with createElement and textContent only. Nothing else is allowed. Inline styles set through the CSSOM (element.style) are
 * not subject to CSP, so the HUD and canvas sizing keep working under style-src 'self'.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "manifest-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "require-trusted-types-for 'script'",
].join('; ');

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

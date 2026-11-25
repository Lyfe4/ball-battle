// The first paint is the real frame (ADR 0087): the game's one font file is preloaded, so it lands
// with the script instead of being found only once the stylesheet is parsed (on Slow 4G it came
// 0.35 s after the first paint, and every name re-flowed). The file's name is hashed at build, so
// this Vite plugin finds it in the bundle and writes the preload into index.html. The dev server
// (and so every browser test) gets the same preload for the file's dev URL, so the tests load the
// page the way production does.
//
// One download in every engine (checked 2026-11-25 against a server that logs each request, with
// the font held back 1.5 s): Chromium and Firefox fetch an @font-face in CORS mode and reuse the
// `crossorigin` preload; WebKit asks for a same-origin font in no-cors mode, yet serves it from the
// preload it already holds. Playwright's request events in WebKit list that reuse as a second
// request, which is why a WebKit run once looked like two downloads (font-once.safari.browser.test.ts
// counts what reaches the server instead).
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isAbsolute, relative } from 'node:path';
import { normalizePath, type Plugin } from 'vite';

/**
 * The Latin subset of Bricolage Grotesque's variable font (@fontsource-variable): every word the
 * game writes. Its other subsets (Latin Extended, Vietnamese) load only for a character in their
 * `unicode-range`, so preloading them would cost every player bytes nobody needs.
 */
export const PRELOADED_FONT = /^assets\/bricolage-grotesque-latin-wght-normal-[\w-]+\.woff2$/;

/** The same file as the stylesheet's `@import` resolves it (the dev server's URL is its path). */
const FONT_FILE =
  '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2';

interface PreloadTag {
  readonly tag: 'link';
  readonly attrs: Readonly<Record<string, string | boolean>>;
}

/**
 * The preload tag for `href`. A font is fetched in CORS mode, so its preload must be too
 * (`crossorigin`), or Chromium and Firefox fetch it twice. font-src 'self' covers it: the file is
 * served from the site itself.
 */
function preloadTag(href: string): PreloadTag {
  return {
    tag: 'link',
    attrs: { rel: 'preload', href, as: 'font', type: 'font/woff2', crossorigin: true },
  };
}

/**
 * The URL the dev server gives `file` in a stylesheet: its path from the root, or under `/@fs/`
 * when it lies outside the root (Vite's own rule).
 */
export function devFontUrlOf(root: string, file: string): string {
  const path = relative(root, file);
  return path.startsWith('..') || isAbsolute(path)
    ? `/@fs/${normalizePath(file).replace(/^\//, '')}`
    : `/${normalizePath(path)}`;
}

/** The preload tag for the one font in `files` (a bundle's file names); throws unless exactly one. */
export function fontPreloadOf(files: readonly string[]): PreloadTag {
  const found = files.filter((file) => PRELOADED_FONT.test(file));
  if (found.length !== 1) {
    throw new Error(
      `Expected one font file to preload (${PRELOADED_FONT.source}), found ${String(found.length)}: ` +
        'a renamed font must update scripts/font-preload.ts',
    );
  }
  return preloadTag(`/${found[0] ?? ''}`);
}

/**
 * The pages that get the preload: the game's, and the legal pages (privacy, terms), which draw in the
 * same font with no script (so no hidden boot): without the preload their title re-flowed as the
 * font landed after the first paint (ADR 0087; the staging walk of 2026-11-26).
 */
const PRELOADED_PAGES: ReadonlySet<string> = new Set([
  '/index.html',
  '/privacy.html',
  '/terms.html',
]);

/** Whether the page at `path` (as Vite names it, from the root) preloads the font. */
export function preloadsFont(path: string): boolean {
  return PRELOADED_PAGES.has(path);
}

/** Adds the font's preload to the game's page and the legal pages, in a build and in dev. */
export function fontPreload(): Plugin {
  let root = '';
  return {
    name: 'ballbattle-font-preload',
    configResolved(config) {
      root = config.root;
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        if (!preloadsFont(context.path)) return undefined;
        if (context.bundle !== undefined) {
          return [{ ...fontPreloadOf(Object.keys(context.bundle)), injectTo: 'head' }];
        }
        if (context.server === undefined) return undefined;
        // pnpm links packages: the stylesheet names the file by its real path.
        const file = realpathSync(createRequire(`${root}/`).resolve(FONT_FILE));
        return [{ ...preloadTag(devFontUrlOf(root, file)), injectTo: 'head' }];
      },
    },
  };
}

// The first paint is the real frame (ADR 0087): the game's one font file is preloaded, so it lands
// with the script instead of being found only once the stylesheet is parsed (on Slow 4G it came
// 0.35 s after the first paint, and every name re-flowed). The file's name is hashed at build, so
// this Vite plugin finds it in the bundle and writes the preload into index.html.
import type { Plugin } from 'vite';

/**
 * The Latin subset of Bricolage Grotesque's variable font (@fontsource-variable): every word the
 * game writes. Its other subsets (Latin Extended, Vietnamese) load only for a character in their
 * `unicode-range`, so preloading them would cost every player bytes nobody needs.
 */
export const PRELOADED_FONT = /^assets\/bricolage-grotesque-latin-wght-normal-[\w-]+\.woff2$/;

/** The preload tag for the one font in `files` (a bundle's file names); throws unless exactly one. */
export function fontPreloadOf(files: readonly string[]): {
  readonly tag: 'link';
  readonly attrs: Readonly<Record<string, string | boolean>>;
} {
  const found = files.filter((file) => PRELOADED_FONT.test(file));
  if (found.length !== 1) {
    throw new Error(
      `Expected one font file to preload (${PRELOADED_FONT.source}), found ${String(found.length)}: ` +
        'a renamed font must update scripts/font-preload.ts',
    );
  }
  return {
    tag: 'link',
    // A font is fetched in CORS mode, so its preload must be too (`crossorigin`), or the browser
    // fetches it twice. font-src 'self' covers it: the file is served from the site itself.
    attrs: {
      rel: 'preload',
      href: `/${found[0] ?? ''}`,
      as: 'font',
      type: 'font/woff2',
      crossorigin: true,
    },
  };
}

/** Adds the font's preload to the game's page (not the legal pages) in a build. */
export const fontPreload: Plugin = {
  name: 'ballbattle-font-preload',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler(_html, context) {
      if (context.path !== '/index.html' || context.bundle === undefined) return undefined;
      return [{ ...fontPreloadOf(Object.keys(context.bundle)), injectTo: 'head' }];
    },
  },
};

import { describe, expect, it } from 'vitest';
import { devFontUrlOf, fontPreloadOf } from './font-preload.ts';

describe('the font preload', () => {
  it('names the Latin subset only, in CORS mode', () => {
    const preload = fontPreloadOf([
      'assets/main-Bel_uBwl.js',
      'assets/bricolage-grotesque-latin-ext-wght-normal-CcLUaPy7.woff2',
      'assets/bricolage-grotesque-latin-wght-normal-DLoelf7F.woff2',
      'assets/bricolage-grotesque-vietnamese-wght-normal-BUzh504Q.woff2',
    ]);
    expect(preload).toStrictEqual({
      tag: 'link',
      attrs: {
        rel: 'preload',
        href: '/assets/bricolage-grotesque-latin-wght-normal-DLoelf7F.woff2',
        as: 'font',
        type: 'font/woff2',
        crossorigin: true,
      },
    });
  });

  it('fails the build when the font is not in the bundle', () => {
    expect(() => fontPreloadOf(['assets/main-Bel_uBwl.js'])).toThrow(/found 0/);
  });
});

describe('the font in dev', () => {
  it('is named by its path from the root, as the stylesheet names it', () => {
    expect(devFontUrlOf('C:/game', 'C:/game/node_modules/.pnpm/f/files/a.woff2')).toBe(
      '/node_modules/.pnpm/f/files/a.woff2',
    );
  });

  it('is under /@fs/ outside the root', () => {
    expect(devFontUrlOf('C:/game', 'C:/store/f/files/a.woff2')).toBe(
      '/@fs/C:/store/f/files/a.woff2',
    );
  });
});

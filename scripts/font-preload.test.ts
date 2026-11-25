import { describe, expect, it } from 'vitest';
import { fontPreloadOf } from './font-preload.ts';

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

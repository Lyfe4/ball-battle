// The game's font downloads once on a first visit (ADR 0087, scripts/font-preload.ts): the preload
// and the stylesheet's @font-face share one request. Counted at the server (scripts/first-visit.ts),
// so a preload the stylesheet can't use (a `crossorigin`, type or URL that doesn't match) shows as
// a second download.
//
// Not in WebKit, which asks for a same-origin font in no-cors mode and reuses the CORS preload only
// as production serves it: a built page fetched the font once in WebKit against a logging server
// (no cache headers, `no-cache`, and netlify.toml's `immutable`, the font held back 0 or 1.5 s;
// 2026-11-25). The dev server injects the stylesheet by script, after the preload has settled, and
// answers with `Vary: Origin`, and there WebKit fetches the font a second time. WebKit is counted
// against the built pages as production serves them instead (scripts/font-once.ts, in CI's browser
// jobs), the legal pages too.
import { describe, expect, it } from 'vitest';
import { commands, server } from 'vitest/browser';

declare module 'vitest/browser' {
  interface BrowserCommands {
    firstVisitRequests: (search: string, suffix: string) => Promise<Record<string, number>>;
  }
}

describe.skipIf(server.browser === 'webkit')('the font on a first visit', () => {
  it('downloads once, preloaded, on Play', async () => {
    const fonts = await commands.firstVisitRequests('', '.woff2');
    expect(Object.values(fonts), JSON.stringify(fonts)).toStrictEqual([1]);
    expect(Object.keys(fonts)[0]).toMatch(/bricolage-grotesque-latin-wght-normal\.woff2$/);
  });

  it('downloads once on Balls', async () => {
    const fonts = await commands.firstVisitRequests('?view=manual', '.woff2');
    expect(Object.values(fonts), JSON.stringify(fonts)).toStrictEqual([1]);
  });
});

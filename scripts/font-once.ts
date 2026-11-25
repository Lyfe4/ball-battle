// The game's font downloads once on a first visit, in every engine (ADR 0087): the built pages as
// production serves them. `font-once.safari.browser.test.ts` counts at the dev server and skips
// WebKit, because there the stylesheet arrives by script after the preload has settled and WebKit
// fetches the font again; production doesn't. This serves `dist/` with `vite preview` (the
// production security headers), opens each page as a first visit (a fresh browser context whose
// requests carry one header) and counts what reaches the server, which sees only real downloads.
//
// node scripts/font-once.ts [chromium|firefox|webkit ...], after `pnpm build`. Exits 1 on any page
// that fetches a font other than the preloaded one, or that one other than once.
import { pathToFileURL } from 'node:url';
import { chromium, firefox, webkit, type BrowserType } from 'playwright';
import { preview, type Plugin } from 'vite';
import { PRELOADED_FONT } from './font-preload.ts';

const VISIT_HEADER = 'x-ballbattle-first-visit';

/** Every page a player can land on first: the game (two screens) and the legal pages. */
export const PAGES: readonly string[] = ['/', '/?view=manual', '/privacy.html', '/terms.html'];

const ENGINES: Readonly<Record<string, BrowserType>> = { chromium, firefox, webkit };

/** Each visit's font requests, by visit id, then by path. */
const visits = new Map<string, Map<string, number>>();

/**
 * Counts each visit's font requests, and serves the built assets as Netlify does (netlify.toml):
 * cached for good, and with no CORS headers. `vite preview` answers every request with
 * `Vary: Origin` by default, and with that WebKit fetches the font a second time; production sends
 * none (staging checked 2026-11-25), so neither does this server (`cors: false` below).
 */
const counter: Plugin = {
  name: 'ballbattle-font-once-counter',
  configurePreviewServer(server) {
    server.middlewares.use((request, response, next) => {
      const id = request.headers[VISIT_HEADER];
      const counts = typeof id === 'string' ? visits.get(id) : undefined;
      const path = (request.url ?? '').split('?')[0] ?? '';
      if (counts !== undefined && path.endsWith('.woff2')) {
        counts.set(path, (counts.get(path) ?? 0) + 1);
      }
      if (path.startsWith('/assets/')) {
        response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
      next();
    });
  },
};

/** What is wrong with one visit's font requests: nothing when the preloaded file came once. */
export function fontProblem(counts: ReadonlyMap<string, number>): string | undefined {
  const entries = [...counts];
  const preloaded = entries.filter(([path]) => PRELOADED_FONT.test(path.replace(/^\//, '')));
  if (preloaded.length === 1 && preloaded[0]?.[1] === 1 && entries.length === 1) return undefined;
  return JSON.stringify(Object.fromEntries(entries));
}

async function main(): Promise<void> {
  const names = process.argv.slice(2);
  const engines = names.length > 0 ? names : Object.keys(ENGINES);
  const server = await preview({
    plugins: [counter],
    preview: { port: 4298, strictPort: false, cors: false },
    logLevel: 'warn',
  });
  const base = server.resolvedUrls?.local[0];
  if (base === undefined) throw new Error('The preview server has no URL');
  const failures: string[] = [];
  let next = 0;
  try {
    for (const name of engines) {
      const engine = ENGINES[name];
      if (engine === undefined) throw new Error(`No engine "${name}"`);
      const browser = await engine.launch();
      try {
        for (const page of PAGES) {
          const id = `visit-${String(next++)}`;
          const counts = new Map<string, number>();
          visits.set(id, counts);
          const context = await browser.newContext({ extraHTTPHeaders: { [VISIT_HEADER]: id } });
          const tab = await context.newPage();
          await tab.goto(new URL(page, base).href);
          // A string, as it runs in the page (this file has no DOM types).
          await tab.waitForFunction(
            "document.getElementById('stage')?.hasAttribute('data-booting') !== true && document.fonts.status === 'loaded'",
          );
          await tab.waitForTimeout(500);
          await context.close();
          const problem = fontProblem(counts);
          console.log(`${name} ${page}: ${problem ?? 'once'}`);
          if (problem !== undefined) failures.push(`${name} ${page}: ${problem}`);
        }
      } finally {
        await browser.close();
      }
    }
  } finally {
    await server.close();
  }
  if (failures.length > 0) {
    console.error(`The font did not download exactly once:\n${failures.join('\n')}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();

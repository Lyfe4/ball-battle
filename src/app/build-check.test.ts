import { describe, expect, it, vi } from 'vitest';
import { assetsOf, CHECK_GAP_MS, createBuildCheck } from './build-check.ts';

/** An index.html as Vite builds it: one script and one stylesheet, named by content hash. */
const page = (script: string, style: string) => `<!doctype html>
<html lang="en">
  <head>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <script type="module" crossorigin src="/assets/${script}"></script>
    <link rel="stylesheet" crossorigin href="/assets/${style}">
  </head>
  <body><main class="stage" id="stage"></main></body>
</html>`;

const OLD = page('index-upiV00it.js', 'index-_6uxHbYr.css');
const NEW = page('index-Q2w9xYzA.js', 'index-_6uxHbYr.css');
const LOADED = ['/assets/index-_6uxHbYr.css', '/assets/index-upiV00it.js'];

/**
 * The page as staging serves it since the font preload (ADR 0087, 2026-11-25): the entry script,
 * its stylesheet, the preloaded font and, where Vite splits chunks, a module preload. Only the
 * script and stylesheet are what the page itself counts (`loadedAssets`), so only they compare.
 */
const SERVED = (script: string) => `<!doctype html>
<html lang="en">
  <head>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <script type="module" crossorigin src="/assets/${script}"></script>
    <link rel="modulepreload" crossorigin href="/assets/chunk-B1u2v3w4.js">
    <link rel="stylesheet" crossorigin href="/assets/index-_6uxHbYr.css">
    <link rel="preload" href="/assets/bricolage-grotesque-latin-wght-normal-DLoelf7F.woff2" as="font" type="font/woff2" crossorigin>
  </head>
  <body><main class="stage" id="stage"></main></body>
</html>`;

describe('assetsOf', () => {
  it('reads what the page counts as loaded: no preloaded font or module preload (false alarm of 2026-11-26)', () => {
    expect(assetsOf(SERVED('index-upiV00it.js'))).toStrictEqual(LOADED);
  });

  it('lists the built script and stylesheet, sorted, and nothing outside /assets/', () => {
    expect(assetsOf(OLD)).toStrictEqual(LOADED);
  });

  it('finds none in a page that isn’t a build (an error page, a portal, the dev server)', () => {
    expect(assetsOf('<html><body>502 Bad Gateway</body></html>')).toStrictEqual([]);
    expect(assetsOf('<script type="module" src="/src/main.ts"></script>')).toStrictEqual([]);
  });
});

/** A check whose clock and deployed page the test sets. */
function checker(deployed: () => Promise<string | undefined>, loaded = LOADED) {
  let now = 1_000_000;
  const fetchIndex = vi.fn(deployed);
  const found = vi.fn();
  const check = createBuildCheck({ loaded, fetchIndex, now: () => now, found });
  return {
    check,
    fetchIndex,
    found,
    wait: (ms: number) => {
      now += ms;
    },
  };
}

describe('createBuildCheck', () => {
  it('finds a newer build when the deployed page names other assets', async () => {
    const { check, found, wait } = checker(() => Promise.resolve(NEW));
    wait(CHECK_GAP_MS);
    await check.check();
    expect(found).toHaveBeenCalledOnce();
  });

  it('finds nothing when the same build is served with its font and chunks preloaded', async () => {
    const { check, found, wait } = checker(() => Promise.resolve(SERVED('index-upiV00it.js')));
    wait(CHECK_GAP_MS);
    await check.check();
    expect(found).not.toHaveBeenCalled();
  });

  it('still finds a newer build behind the preloads', async () => {
    const { check, found, wait } = checker(() => Promise.resolve(SERVED('index-Q2w9xYzA.js')));
    wait(CHECK_GAP_MS);
    await check.check();
    expect(found).toHaveBeenCalledOnce();
  });

  it('finds nothing while the deployed page names the same assets', async () => {
    const { check, found, wait } = checker(() => Promise.resolve(OLD));
    wait(CHECK_GAP_MS);
    await check.check();
    expect(found).not.toHaveBeenCalled();
  });

  it('asks at most once a gap, the first a gap after loading, and never after finding one', async () => {
    const { check, fetchIndex, found, wait } = checker(() => Promise.resolve(NEW));
    await check.check();
    expect(fetchIndex, 'the page has just loaded the deployed build').not.toHaveBeenCalled();
    wait(CHECK_GAP_MS);
    await check.check();
    wait(CHECK_GAP_MS);
    await check.check();
    expect(fetchIndex).toHaveBeenCalledOnce();
    expect(found).toHaveBeenCalledOnce();
  });

  it('switching tabs back and forth asks once a minute at most', async () => {
    const { check, fetchIndex, wait } = checker(() => Promise.resolve(OLD));
    for (let second = 0; second < 180; second += 5) {
      wait(5_000);
      await check.check();
    }
    expect(fetchIndex).toHaveBeenCalledTimes(3);
  });

  it('says nothing when offline, on a failed answer or on a page that isn’t a build', async () => {
    for (const answer of [
      () => Promise.reject(new TypeError('Failed to fetch')),
      () => Promise.resolve(undefined),
      () => Promise.resolve('<html><body>Sign in to the Wi-Fi</body></html>'),
    ]) {
      const { check, found, wait } = checker(answer);
      wait(CHECK_GAP_MS);
      await check.check();
      expect(found).not.toHaveBeenCalled();
    }
  });

  it('never asks where the page loaded no built assets (the dev server)', async () => {
    const { check, fetchIndex, wait } = checker(() => Promise.resolve(NEW), []);
    wait(CHECK_GAP_MS);
    await check.check();
    expect(fetchIndex).not.toHaveBeenCalled();
  });
});

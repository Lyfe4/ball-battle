// Whether a newer build is deployed than the one this tab runs (issue #17, ADR 0066). Built assets
// are cached for good and only a reload fetches a new `index.html`, so a tab left open across a
// deploy runs the old build indefinitely. Every build names its script and stylesheet by content
// hash in `index.html`; the page compares the ones it loaded with the ones a fresh `index.html`
// names. No version file and no build step: any change to what ships changes a name.

/** The built assets an `index.html` loads: its `/assets/` script and stylesheet URLs, sorted. */
export function assetsOf(html: string): readonly string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(
    /<(?:script|link)\b[^>]*?\b(?:src|href)="(\/assets\/[^"]+)"/g,
  )) {
    const url = match[1];
    if (url !== undefined) found.add(url);
  }
  return [...found].sort();
}

/** Far enough apart that switching tabs back and forth costs nothing worth counting. */
export const CHECK_GAP_MS = 60_000;

export interface BuildCheckHost {
  /** The assets this page loaded (`loadedAssets` in new-version.ts); none means nothing to compare (dev). */
  readonly loaded: readonly string[];
  /** The deployed `index.html`, never from a cache; rejects or returns undefined on any failure. */
  fetchIndex(): Promise<string | undefined>;
  /** This device's clock in ms (only the gap between checks reads it). */
  now(): number;
  /** A newer build is deployed: called once. */
  found(): void;
}

export interface BuildCheck {
  /** Asks, unless the last ask was under CHECK_GAP_MS ago or a newer build is already known. */
  check(): Promise<void>;
}

/**
 * Checks on request only (a tab coming back into view, home opening): never on a timer. The page
 * has just loaded the deployed build, so the first check waits a gap too.
 */
export function createBuildCheck(host: BuildCheckHost): BuildCheck {
  let last = host.now();
  let known = false;
  return {
    async check() {
      if (known || host.loaded.length === 0 || host.now() - last < CHECK_GAP_MS) return;
      last = host.now();
      let html: string | undefined;
      try {
        html = await host.fetchIndex();
      } catch {
        return;
      }
      if (html === undefined) return;
      const deployed = assetsOf(html);
      // A page with no built assets (an error page, a captive portal) says nothing about builds.
      if (deployed.length === 0) return;
      if (deployed.join(' ') === host.loaded.join(' ')) return;
      known = true;
      host.found();
    },
  };
}

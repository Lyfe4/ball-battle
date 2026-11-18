// A tab running an older build than the one deployed (issue #17, ADR 0066): checked when the tab
// comes back into view and when home opens, at most once a minute and never on a timer, and said
// at the next calm moment with a Reload card. main.ts says when the screen is calm.
import { createBuildCheck } from '../app/build-check.ts';
import { createUpdateNotice } from '../ui/update-notice.ts';

/** The built assets this page loaded, by path; none under Vite's dev server. */
export function loadedAssets(doc: Document): readonly string[] {
  const urls = [
    ...[...doc.querySelectorAll('script[src]')].map((node) => node.getAttribute('src')),
    ...[...doc.querySelectorAll('link[rel="stylesheet"][href]')].map((node) =>
      node.getAttribute('href'),
    ),
  ];
  const paths = urls.map((url) => new URL(url ?? '', window.location.href).pathname);
  return [...new Set(paths.filter((path) => path.startsWith('/assets/')))].sort();
}

/** The deployed `index.html`, past every cache; undefined unless the answer is a page. */
export async function fetchIndex(): Promise<string | undefined> {
  const response = await fetch('/', { cache: 'no-store', credentials: 'same-origin' });
  return response.ok ? response.text() : undefined;
}

export interface NewVersion {
  /** Home opened: a calm place to ask. */
  homeShown(): void;
  /** Whether the screen is at a calm moment now (`isCalmMoment`). */
  setCalm(calm: boolean): void;
}

export function installNewVersion(root: HTMLElement): NewVersion {
  const notice = createUpdateNotice(root, () => {
    window.location.reload();
  });
  const check = createBuildCheck({
    loaded: loadedAssets(document),
    fetchIndex,
    now: () => Date.now(),
    found: () => {
      notice.found();
    },
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check.check();
  });
  return {
    homeShown: () => void check.check(),
    setCalm: (calm) => {
      notice.setCalm(calm);
    },
  };
}

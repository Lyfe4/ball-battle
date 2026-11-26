// The new-version card (ADR 0066): only at a calm moment, waiting through a fight when found during
// one, Reload as its one button; and the assets a page loaded, read from the page.
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../styles/tokens.css';
import './button.css';
import './update-notice.css';
import { assetsOf } from '../app/build-check.ts';
import { loadedAssets } from '../screens/new-version.ts';
import { createUpdateNotice, UPDATE_TEXT } from './update-notice.ts';

function card() {
  const root = document.createElement('div');
  root.className = 'update-notice';
  root.setAttribute('role', 'status');
  root.hidden = true;
  document.body.append(root);
  const reload = vi.fn();
  return { root, reload, notice: createUpdateNotice(root, reload) };
}

const shown = (root: HTMLElement) => !root.hidden && getComputedStyle(root).display !== 'none';

afterEach(() => {
  document.body.replaceChildren();
  document.body.removeAttribute('data-update');
});

describe('the new-version card', () => {
  it('shows at a calm moment once a newer build is found, and Reload reloads', () => {
    const { root, reload, notice } = card();
    notice.setCalm(true);
    expect(shown(root), 'nothing found yet').toBe(false);
    notice.found();
    expect(shown(root)).toBe(true);
    expect(root.textContent).toContain(UPDATE_TEXT);
    const button = root.querySelector('button');
    expect(button?.getAttribute('aria-label')).toBe('Reload to get the new version');
    button?.click();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('found during a fight, waits for the next calm moment, and makes way again', () => {
    const { root, notice } = card();
    notice.setCalm(false);
    notice.found();
    expect(shown(root), 'never over a fight').toBe(false);
    expect(root.textContent, 'nothing for a screen reader to hear yet').toBe('Reload');
    notice.setCalm(true);
    expect(shown(root)).toBe(true);
    expect(document.body.hasAttribute('data-update'), 'the page makes room under it').toBe(true);
    notice.setCalm(false);
    expect(shown(root)).toBe(false);
    expect(document.body.hasAttribute('data-update')).toBe(false);
  });

  it('keeps its button a full tap target', () => {
    const { root, notice } = card();
    notice.found();
    notice.setCalm(true);
    const button = root.querySelector('button');
    expect(button?.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  });
});

describe('loadedAssets', () => {
  it('reads the built script and stylesheet a page loaded, by path, sorted', () => {
    const doc = document.implementation.createHTMLDocument('');
    doc.head.innerHTML = `<link rel="icon" href="/favicon.svg">
      <script type="module" src="/assets/index-upiV00it.js"></script>
      <link rel="stylesheet" href="/assets/index-_6uxHbYr.css">`;
    expect(loadedAssets(doc)).toStrictEqual([
      '/assets/index-_6uxHbYr.css',
      '/assets/index-upiV00it.js',
    ]);
  });

  it('counts a served page as the check counts it, preloads and all (false alarm of 2026-11-26)', () => {
    // The head staging serves since the font preload (ADR 0087): one rule on both sides, or the
    // same build reads as a new one after every game.
    const html = `<!doctype html><html><head>
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <script type="module" crossorigin src="/assets/main-CKIH6pF5.js"></script>
      <link rel="modulepreload" crossorigin href="/assets/chunk-B1u2v3w4.js">
      <link rel="stylesheet" crossorigin href="/assets/main-CK1NFlc2.css">
      <link rel="preload" href="/assets/bricolage-grotesque-latin-wght-normal-DLoelf7F.woff2" as="font" type="font/woff2" crossorigin>
    </head><body></body></html>`;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(loadedAssets(doc)).toStrictEqual(assetsOf(html));
    expect(loadedAssets(doc)).toHaveLength(2);
  });

  it('reads none on the dev server, so nothing is ever checked there', () => {
    const doc = document.implementation.createHTMLDocument('');
    doc.head.innerHTML = '<script type="module" src="/src/main.ts"></script>';
    expect(loadedAssets(doc)).toStrictEqual([]);
  });
});

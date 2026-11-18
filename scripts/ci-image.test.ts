// The browser jobs run in Playwright's Docker image (ADR 0065), whose browsers are the builds of
// the Playwright release it is tagged with. A Playwright update (Dependabot's monthly one) that
// left the image behind would launch browsers that release doesn't know; this fails first.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const installed = (
  createRequire(import.meta.url)('playwright/package.json') as { readonly version: string }
).version;

describe('the browser jobs’ image', () => {
  const images = [...workflow.matchAll(/^\s*image: (mcr\.microsoft\.com\/playwright:\S+)$/gm)].map(
    (match) => match[1],
  );

  it('is used by one job', () => {
    expect(images).toHaveLength(1);
  });

  it('is the installed Playwright’s, on the runner’s Ubuntu, pinned by digest', () => {
    expect(images[0]).toMatch(
      new RegExp(
        `^mcr\\.microsoft\\.com/playwright:v${installed.replaceAll('.', '\\.')}-noble@sha256:[0-9a-f]{64}$`,
      ),
    );
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PATH_HEADERS, SECURITY_HEADERS } from './security-headers.ts';

const toml = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');

/** Each `[[headers]]` block of netlify.toml: its `for` path and its header lines, in order. */
function headerBlocks(): { readonly path: string; readonly headers: Record<string, string> }[] {
  return toml
    .split('[[headers]]')
    .slice(1)
    .map((block) => {
      const path = /^\s*for = "(.*)"$/m.exec(block)?.[1] ?? '';
      const values = block.split('[headers.values]')[1] ?? '';
      const headers: Record<string, string> = {};
      for (const match of values.matchAll(/^\s*([\w-]+) = "(.*)"$/gm)) {
        const [, name, value] = match;
        if (name !== undefined && value !== undefined) headers[name] = value;
      }
      return { path, headers };
    });
}

const headersFor = (path: string) => headerBlocks().find((block) => block.path === path)?.headers;

describe('netlify.toml', () => {
  it('serves exactly the security headers vite preview serves', () => {
    expect(headersFor('/*')).toStrictEqual(SECURITY_HEADERS);
  });

  it('overrides headers for exactly the paths PATH_HEADERS lists, and nothing else', () => {
    for (const [path, headers] of Object.entries(PATH_HEADERS)) {
      expect(headersFor(path)).toStrictEqual(headers);
    }
    expect(headerBlocks().map((block) => block.path)).toStrictEqual([
      '/*',
      ...Object.keys(PATH_HEADERS),
      '/assets/*',
    ]);
  });

  it('builds with pnpm into dist on Node 24', () => {
    expect(toml).toMatch(/^\s*command = "pnpm build"$/m);
    expect(toml).toMatch(/^\s*publish = "dist"$/m);
    expect(toml).toMatch(/^\s*NODE_VERSION = "24"$/m);
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SECURITY_HEADERS } from './security-headers.ts';

const toml = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');

/** The header lines of netlify.toml's `for = "/*"` block, as name/value pairs. */
function siteWideHeaders(): Map<string, string> {
  const block = /for = "\/\*"\s*\[headers\.values\]([\s\S]*?)(?:\n\s*\n|$)/.exec(toml)?.[1] ?? '';
  const headers = new Map<string, string>();
  for (const match of block.matchAll(/^\s*([\w-]+) = "(.*)"$/gm)) {
    const [, name, value] = match;
    if (name !== undefined && value !== undefined) headers.set(name, value);
  }
  return headers;
}

describe('netlify.toml', () => {
  it('serves exactly the security headers vite preview serves', () => {
    expect(Object.fromEntries(siteWideHeaders())).toStrictEqual(SECURITY_HEADERS);
  });

  it('builds with pnpm into dist on Node 24', () => {
    expect(toml).toMatch(/^\s*command = "pnpm build"$/m);
    expect(toml).toMatch(/^\s*publish = "dist"$/m);
    expect(toml).toMatch(/^\s*NODE_VERSION = "24"$/m);
  });
});

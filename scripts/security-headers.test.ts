import { LOCAL_REALTIME_ORIGIN, withLocalRealtime } from '../src/flows/realtime-policy.ts';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  LOCAL_REALTIME,
  LOCAL_SECURITY_HEADERS,
  PATH_HEADERS,
  REALTIME_ORIGINS,
  SECURITY_HEADERS,
} from './security-headers.ts';
import { PROJECTS } from './supabase-projects.ts';

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

describe('the Realtime poke’s sockets (ADR 0082)', () => {
  const connectOf = (headers: Readonly<Record<string, string>>): string[] =>
    (headers['Content-Security-Policy'] ?? '')
      .split('; ')
      .find((directive) => directive.startsWith('connect-src '))
      ?.split(' ')
      .slice(1) ?? [];

  it('lets the page reach staging’s and production’s Realtime, over wss only', () => {
    expect(REALTIME_ORIGINS).toStrictEqual(
      [PROJECTS.staging, PROJECTS.production].map((ref) => `wss://${ref}.supabase.co`),
    );
    expect(connectOf(SECURITY_HEADERS)).toStrictEqual(["'self'", ...REALTIME_ORIGINS]);
  });

  it('adds the local stack’s Realtime for pnpm preview alone, and nothing else', () => {
    expect(connectOf(LOCAL_SECURITY_HEADERS)).toStrictEqual([
      "'self'",
      ...REALTIME_ORIGINS,
      LOCAL_REALTIME,
    ]);
    const rest = (headers: Readonly<Record<string, string>>) =>
      headers['Content-Security-Policy']?.replace(/connect-src [^;]*/, '');
    expect(rest(LOCAL_SECURITY_HEADERS)).toBe(rest(SECURITY_HEADERS));
    expect({ ...LOCAL_SECURITY_HEADERS, 'Content-Security-Policy': '' }).toStrictEqual({
      ...SECURITY_HEADERS,
      'Content-Security-Policy': '',
    });
    expect(toml).not.toContain('127.0.0.1');
  });

  it('gives netlify dev’s pages, in the online flows only, exactly pnpm preview’s policy (ADR 0082)', () => {
    const served = SECURITY_HEADERS['Content-Security-Policy'] ?? '';
    expect(withLocalRealtime(served)).toBe(LOCAL_SECURITY_HEADERS['Content-Security-Policy']);
    expect(LOCAL_REALTIME_ORIGIN).toBe(LOCAL_REALTIME);
    expect(withLocalRealtime(withLocalRealtime(served))).toBe(withLocalRealtime(served));
    expect(() => withLocalRealtime("default-src 'none'")).toThrow(/No connect-src/);
    // netlify.toml, what netlify dev and every deploy serve, never names a local socket.
    expect(toml).not.toContain('ws://');
  });
});

// vs Friend's switch on the live site (ADR 0068): production builds its client from the same
// BALLBATTLE_ONLINE the functions read, so the page and the API are switched together, and unset is
// off. Deploy previews and the main branch deploy are always on.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { configOf } from '../src/server/config.ts';

const toml = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');

/** The lines of one `[section]` of netlify.toml, up to the next section. */
function section(name: string): string {
  const start = toml.indexOf(`[${name}]\n`);
  if (start < 0) return '';
  const rest = toml.slice(start + name.length + 3);
  const end = rest.search(/^\[/m);
  return end < 0 ? rest : rest.slice(0, end);
}

describe('the vs Friend switch', () => {
  it('builds production’s client from BALLBATTLE_ONLINE, unset meaning off', () => {
    expect(section('context.production')).toContain(
      'command = "VITE_ONLINE=\\"${BALLBATTLE_ONLINE:-}\\" pnpm build"',
    );
  });

  it('never switches production on in the repository itself', () => {
    expect(section('context.production.environment')).toBe('');
    expect(section('build.environment')).not.toContain('VITE_ONLINE');
    expect(section('build.environment')).not.toContain('BALLBATTLE_ONLINE');
  });

  it('keeps previews and the main branch deploy on', () => {
    expect(section('context.deploy-preview.environment')).toContain('VITE_ONLINE = "1"');
    expect(section('context.branch-deploy.environment')).toContain('VITE_ONLINE = "1"');
  });

  it('means the same to the functions: only "1" is on', () => {
    for (const value of [undefined, '', '0', 'true', ' 1']) {
      expect(configOf({ BALLBATTLE_ONLINE: value })).toBeUndefined();
    }
  });
});

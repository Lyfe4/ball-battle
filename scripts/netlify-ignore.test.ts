// Netlify's build ignore rule (scripts/netlify-ignore.sh): exit 0 skips a build. Run against a
// throwaway repository: a push of docs, Markdown, workflows or tests alone skips; anything the site
// or its functions use builds, and so do a retry of the same commit and a first build.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SCRIPT = new URL('netlify-ignore.sh', import.meta.url);
let repo: string;

const git = (...args: string[]): string =>
  execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();

/** Commits `files` (path to text) and returns the commit. */
function commit(files: Record<string, string>): string {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), text);
  }
  git('add', '-A');
  git('commit', '-q', '-m', 'change');
  return git('rev-parse', 'HEAD');
}

/** The rule's exit code for a build of `to` after one of `from`: 0 skips. */
function ignore(from: string, to: string): number | null {
  return spawnSync('bash', [join(repo, 'netlify-ignore.sh')], {
    cwd: repo,
    env: { ...process.env, CACHED_COMMIT_REF: from, COMMIT_REF: to },
  }).status;
}

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), 'netlify-ignore-'));
  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  writeFileSync(join(repo, 'netlify-ignore.sh'), readFileSync(SCRIPT, 'utf8'));
  commit({ 'src/main.ts': 'one', 'README.md': 'one' });
});

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('the build ignore rule', () => {
  it('skips a push of docs, Markdown, workflows or tests alone', () => {
    const before = git('rev-parse', 'HEAD');
    const after = commit({
      'docs/decisions/0099-x.md': 'adr',
      'README.md': 'two',
      '.github/workflows/ci.yml': 'jobs',
      'src/app/thing.test.ts': 'test',
    });
    expect(ignore(before, after)).toBe(0);
  });

  it('builds when anything else changed with them: code, a page, a migration', () => {
    for (const file of ['src/main.ts', 'privacy.html', 'supabase/migrations/1_x.sql']) {
      const before = git('rev-parse', 'HEAD');
      const after = commit({ [file]: `changed ${String(Math.random())}`, 'docs/note.md': file });
      expect(ignore(before, after)).toBe(1);
    }
  });

  it('builds a retry or manual deploy of the same commit, a first build and an unknown base', () => {
    const head = git('rev-parse', 'HEAD');
    expect(ignore(head, head)).toBe(1);
    expect(ignore('', head)).toBe(1);
    expect(ignore('0123456789012345678901234567890123456789', head)).toBe(1);
  });
});

// Netlify's build ignore rule (scripts/netlify-ignore.sh): exit 0 skips a build. Run against a
// throwaway repository: a push of docs, Markdown, workflows, tests or test-only support code alone
// skips; anything the site or its functions use builds, and so do a retry of the same commit and a
// first build. Then against this repository: nothing the build reads imports an excluded file.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SCRIPT = new URL('netlify-ignore.sh', import.meta.url);
const ROOT = fileURLToPath(new URL('..', import.meta.url));
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
  return spawnSync('bash', [join(repo, 'scripts/netlify-ignore.sh')], {
    cwd: repo,
    env: { ...process.env, CACHED_COMMIT_REF: from, COMMIT_REF: to },
  }).status;
}

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), 'netlify-ignore-'));
  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  commit({
    'scripts/netlify-ignore.sh': readFileSync(SCRIPT, 'utf8'),
    'src/main.ts': 'one',
    'README.md': 'one',
  });
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

  it('skips a push of test-only support code alone: flows, support files, fakes, this rule', () => {
    const before = git('rev-parse', 'HEAD');
    const after = commit({
      'src/flows/home-flow.ts': 'flow',
      'src/sim/test-support.ts': 'support',
      'src/sim/balls/roster-support.ts': 'support',
      'src/server/test/support.ts': 'support',
      'src/app/fake-history.ts': 'fake',
      'scripts/netlify-ignore.sh': `${readFileSync(SCRIPT, 'utf8')}\n`,
    });
    expect(ignore(before, after)).toBe(0);
  });

  it('builds when anything else changed with them: code, a page, a migration, a script', () => {
    const files = [
      'src/main.ts',
      'src/app/support.ts',
      'privacy.html',
      'supabase/migrations/1_x.sql',
      'scripts/check-bundle.ts',
    ];
    for (const file of files) {
      const before = git('rev-parse', 'HEAD');
      const after = commit({ [file]: `changed ${String(Math.random())}`, 'src/flows/x.ts': file });
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

/** Every tracked file in this repository that the rule ignores, by git's own pathspec matching. */
function ignoredFiles(): Set<string> {
  const excludes = [...readFileSync(SCRIPT, 'utf8').matchAll(/'(:\(exclude\)[^']+)'/g)].map(
    (match) => match[1] ?? '',
  );
  const list = (...spec: string[]): string[] =>
    execFileSync('git', ['ls-files', '--', ...spec], { cwd: ROOT, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
  const kept = new Set(list('.', ...excludes));
  return new Set(list('.').filter((file) => !kept.has(file)));
}

const IMPORT = /(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"?]+)/g;

/** The repository files `file` imports by a relative path. */
function importsOf(file: string): string[] {
  const text = readFileSync(join(ROOT, file), 'utf8');
  const found = file.endsWith('.html')
    ? [...text.matchAll(/src="\/(src\/[^"]+)"/g)].map((match) => match[1] ?? '')
    : [...text.matchAll(IMPORT)].map((match) =>
        posix.normalize(posix.join(posix.dirname(file), match[1] ?? '')),
      );
  return found.flatMap((path) => {
    const candidates = [path, path.replace(/\.js$/, '.ts'), `${path}.ts`, `${path}/index.ts`];
    const hit = candidates.find((candidate) => existsSync(join(ROOT, candidate)));
    return hit === undefined || hit.endsWith('/') ? [] : [hit];
  });
}

describe('what the rule ignores', () => {
  it('is never read by the build: no page, function or build script reaches an ignored file', () => {
    const ignored = ignoredFiles();
    expect(ignored.has('src/flows/browser-setup.ts')).toBe(true);
    expect(ignored.has('src/sim/test-support.ts')).toBe(true);
    const functions = readdirOf('netlify/functions').map((name) => `netlify/functions/${name}`);
    const roots = [
      'index.html',
      'privacy.html',
      'terms.html',
      'vite.config.ts',
      'scripts/check-bundle.ts',
      'scripts/build-online.ts',
      ...functions,
    ];
    const seen = new Set<string>();
    const reached: string[] = [];
    const queue = [...roots];
    for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
      if (seen.has(file) || !/\.(ts|mjs|js|html)$/.test(file)) continue;
      seen.add(file);
      if (ignored.has(file)) reached.push(file);
      queue.push(...importsOf(file));
    }
    expect(seen.has('src/sim/step.ts')).toBe(true);
    expect(seen.has('src/server/live-service.ts')).toBe(true);
    expect(reached).toEqual([]);
  });
});

function readdirOf(dir: string): string[] {
  return execFileSync('git', ['ls-files', '--', dir], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter((file) => file.endsWith('.ts'))
    .map((file) => file.slice(dir.length + 1));
}

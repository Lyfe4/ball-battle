import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkHead } from './site-head.ts';

describe('the page head', () => {
  it('has every tag, and every file it names exists at its declared size', () => {
    expect(checkHead('index.html', 'public')).toStrictEqual([]);
  });

  it('reports a missing tag and a file that does not resolve', () => {
    const dir = mkdtempSync(join(tmpdir(), 'head-'));
    writeFileSync(
      join(dir, 'index.html'),
      '<head><title>x</title><link rel="icon" href="/nope.png" /></head>',
    );
    const problems = checkHead(join(dir, 'index.html'), dir);
    expect(problems).toContain('missing <meta property="og:image">');
    expect(problems).toContain('<link rel="icon"> does not resolve: /nope.png');
  });
});

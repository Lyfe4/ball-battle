import { describe, expect, it } from 'vitest';
import { pageScrubbed, pageStackScrubbed, scrubbed } from './scrub.ts';

describe('a page’s error text as it leaves (launch eve)', () => {
  it('keeps what says what went wrong', () => {
    expect(pageScrubbed('Cannot read properties of undefined (reading x)')).toBe(
      'Cannot read properties of undefined (reading x)',
    );
  });

  it('drops email addresses, quoted text, codes, ids and tokens', () => {
    expect(pageScrubbed('No account for sam@example.co.uk')).toBe('No account for <email>');
    expect(pageScrubbed('Unexpected token "robin_b" in JSON')).toBe('Unexpected token "…" in JSON');
    expect(pageScrubbed(`Name ‘Ana Lúcia’ and 'Zoë' and \`x\``)).toBe('Name "…" and "…" and "…"');
    expect(pageScrubbed('Wrong code 482913 for friend 7731')).toBe('Wrong code <n> for friend <n>');
    expect(pageScrubbed('Series 3f2b9c1e-8a4d-4c2e-9b1a-0d6e5f4c3b2a not found')).toBe(
      'Series <token> not found',
    );
    expect(pageScrubbed('Bad eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ4In0.sig')).toMatch(/^Bad <token>/);
  });

  it('drops a URL’s query and fragment, keeping its path', () => {
    expect(pageScrubbed('Failed https://battle-ball.netlify.app/?start=abc&k=v#top')).toBe(
      'Failed https://battle-ball.netlify.app/',
    );
  });

  it('is cut as the server’s own are', () => {
    expect(pageScrubbed('x '.repeat(2000))).toHaveLength(300);
    expect(scrubbed('Key (name)=(robin) exists')).toBe('Key (name)=(…) exists');
  });

  it('keeps a stack’s frames, without queries, tokens or addresses, and short', () => {
    const stack = [
      'TypeError: x is undefined',
      'onTick@https://battle-ball.netlify.app/assets/main-Ab12Cd34.js?v=1:1:200',
      '    at render (https://battle-ball.netlify.app/assets/arena-Xy98.js:3:40)',
      ...Array.from({ length: 40 }, () => '    at deep (https://x.io/a.js:1:1)'),
    ].join('\n');
    const scrubbedStack = pageStackScrubbed(stack);
    expect(scrubbedStack.split('\n')).toHaveLength(20);
    expect(scrubbedStack).toContain(
      'onTick@https://battle-ball.netlify.app/assets/main-Ab12Cd34.js',
    );
    expect(scrubbedStack).not.toContain('?v=1');
    expect(scrubbedStack).toContain('main-Ab12Cd34.js:1:200');
    expect(pageStackScrubbed('at f (https://x.io/a.js?token=sam@example.com:1:1)')).not.toContain(
      'sam@',
    );
  });
});

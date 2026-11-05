import { describe, expect, it } from 'vitest';
import { outdatedText } from './outdated-text.ts';

describe('outdatedText', () => {
  it('offers today’s rules for an older link, naming what it was', () => {
    const text = outdatedText({ kind: 'series', newer: false });
    expect(text.title).toBe('An older link');
    expect(text.body).toContain('This series was played on an earlier version');
    expect(text.play).toBe('Play with today’s rules');
  });

  it('asks for a reload for a newer link, and offers this version’s rules', () => {
    const text = outdatedText({ kind: 'match', newer: true });
    expect(text.title).toBe('A newer link');
    expect(text.body).toContain('This match was played on a newer version');
    expect(text.body).toContain('Reload');
    expect(text.play).toBe('Play with this version');
  });
});

// Which motion a screen change makes (ADR 0087, PR 19).
import { describe, expect, it } from 'vitest';
import { screenMotionOf } from './screen-motion.ts';

describe('screen motion', () => {
  it('rises into a screen browsed to from a tab, and fades back to the tab', () => {
    expect(screenMotionOf('manual', 'manual-entry')).toBe('rise');
    expect(screenMotionOf('home', 'profile')).toBe('rise');
    expect(screenMotionOf('manual-entry', 'profile')).toBe('rise');
    expect(screenMotionOf('manual-entry', 'manual')).toBe('back');
    expect(screenMotionOf('profile', 'home')).toBe('back');
  });

  it('never moves for a tab change, a task, a fight, the same screen or a first screen', () => {
    expect(screenMotionOf('home', 'manual')).toBe('none');
    expect(screenMotionOf('home', 'series-rules')).toBe('none');
    expect(screenMotionOf('series-rules', 'home')).toBe('none');
    expect(screenMotionOf('profile', 'signin')).toBe('none');
    expect(screenMotionOf('series-lineup', 'series')).toBe('none');
    expect(screenMotionOf('manual-entry', 'manual-entry')).toBe('none');
    expect(screenMotionOf(undefined, 'manual-entry')).toBe('none');
  });
});

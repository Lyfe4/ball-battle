// The game's own Reduce motion (motion.ts, ADR 0087 addendum of 2026-11-28): chosen, the root says
// so, every stylesheet's reduced-motion rules apply as they do for the device's setting, scripts
// asking reducedMotion() hear it, and it is remembered on the device.
import { afterEach, describe, expect, it } from 'vitest';
import '../style.css';
import {
  reduceMotionChosen,
  REDUCE_MOTION_STORAGE_KEY,
  reducedMotion,
  setReduceMotion,
  systemReducesMotion,
} from './motion.ts';

afterEach(() => {
  setReduceMotion(false);
});

describe('the game’s own Reduce motion', () => {
  it('reduces motion everywhere, as the device’s setting does, and remembers it', () => {
    const query = reducedMotion();
    let heard = 0;
    query.addEventListener('change', () => (heard += 1));
    const coach = document.createElement('section');
    coach.className = 'coach coach-enter';
    document.body.replaceChildren(coach);
    const device = systemReducesMotion();
    if (!device) {
      expect(query.matches).toBe(false);
      expect(getComputedStyle(coach).animationName).toBe('coach-in');
    }
    setReduceMotion(true);
    expect(document.documentElement.dataset['motion']).toBe('reduce');
    expect(query.matches).toBe(true);
    expect(heard).toBe(1);
    expect(localStorage.getItem(REDUCE_MOTION_STORAGE_KEY)).toBe('1');
    // The coach's entrance is the reduced one: a fade, nothing moves.
    expect(getComputedStyle(coach).animationName).toBe('coach-fade-in');
    setReduceMotion(false);
    expect(document.documentElement.dataset['motion']).toBeUndefined();
    expect(reduceMotionChosen()).toBe(false);
    expect(localStorage.getItem(REDUCE_MOTION_STORAGE_KEY)).toBeNull();
  });
});

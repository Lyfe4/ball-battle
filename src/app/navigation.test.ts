import { describe, expect, it } from 'vitest';
import { fakeWindow } from './fake-history.ts';
import { createNavigation } from './navigation.ts';

const home = 'https://ballbattle.test/';
const toPick = (params: URLSearchParams) => {
  params.set('view', 'pick');
};

describe('navigation', () => {
  it('goes back to an entry it pushed, and to the parent when it pushed none', () => {
    const { win, href } = fakeWindow(home);
    const navigation = createNavigation(win);
    let parent = 0;
    navigation.back(() => (parent += 1));
    expect(parent).toBe(1);
    navigation.push(toPick);
    expect(href()).toBe(`${home}?view=pick`);
    navigation.back(() => (parent += 1));
    expect(parent).toBe(1);
    expect(href()).toBe(home);
  });

  it('adds no entry when the URL would not change', () => {
    const { win, entries } = fakeWindow(`${home}?view=pick`);
    createNavigation(win).push(toPick);
    expect(entries).toHaveLength(1);
  });

  it('remembers the depth across a reload, from the entry’s state', () => {
    const first = fakeWindow(home);
    createNavigation(first.win).push(toPick);
    // Reloading keeps the entry and its state; a new page reads the depth back.
    const reloaded = fakeWindow(first.href(), first.win.history.state);
    let parent = false;
    createNavigation(reloaded.win).back(() => (parent = true));
    expect(parent).toBe(false);
  });

  it('treats a link opened fresh (no state of ours) as the first entry', () => {
    const { win } = fakeWindow(`${home}?view=manual`, { someone: 'else' });
    let parent = false;
    createNavigation(win).back(() => (parent = true));
    expect(parent).toBe(true);
  });

  it('keeps the depth on replace, and takes it from the entry on Back and Forward', () => {
    const { win, href } = fakeWindow(home);
    const navigation = createNavigation(win);
    let changes = 0;
    navigation.onChange(() => (changes += 1));
    navigation.push(toPick);
    navigation.replace((params) => {
      params.set('a', 'frost');
    });
    expect(href()).toBe(`${home}?view=pick&a=frost`);
    win.history.back();
    expect(changes).toBe(1);
    // Back at the first entry, depth 0: in-app Back goes to the parent.
    let parent = false;
    navigation.back(() => (parent = true));
    expect(parent).toBe(true);
  });
});

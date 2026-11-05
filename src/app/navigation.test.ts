import { describe, expect, it } from 'vitest';
import { createNavigation, type HistoryWindow } from './navigation.ts';

/** An in-memory browser history: entries with their state, Back fires popstate like a browser. */
function fakeWindow(href: string, state: unknown = null) {
  const entries: { href: string; state: unknown }[] = [{ href, state }];
  let index = 0;
  const listeners: ((event: { readonly state: unknown }) => void)[] = [];
  const current = () => entries[index] ?? { href: '', state: null };
  const win: HistoryWindow = {
    history: {
      get state() {
        return current().state;
      },
      pushState(data, _unused, url) {
        entries.splice(index + 1, entries.length, { href: url.href, state: data });
        index += 1;
      },
      replaceState(data, _unused, url) {
        entries[index] = { href: url?.href ?? current().href, state: data };
      },
      back() {
        if (index === 0) return;
        index -= 1;
        for (const listener of listeners) listener({ state: current().state });
      },
    },
    location: {
      get href() {
        return current().href;
      },
    },
    addEventListener(_type, listener) {
      listeners.push(listener);
    },
  };
  return { win, entries, href: () => current().href };
}

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

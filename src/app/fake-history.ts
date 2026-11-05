// An in-memory browser history for tests of navigation and the Back rules: entries with their
// state; Back fires popstate synchronously, like a browser does a moment later.
import type { HistoryWindow } from './navigation.ts';

export function fakeWindow(href: string, state: unknown = null) {
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

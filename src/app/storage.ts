// The browser storage every remembered choice and saved series uses. A getter, because merely
// reading `window.localStorage` can throw (private windows, blocked site data); each reader wraps
// its own access in try/catch and falls back to the default.
export const browserStorage = (): Storage => window.localStorage;

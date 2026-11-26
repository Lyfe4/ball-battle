// The live matches whose end screen already said how their rematch ended ("Jo said no to a
// rematch"): that news is never said again away from it (ADR 0086), also after a reload. Kept for
// the page's session only (sessionStorage: a new tab or a closed browser starts empty) and only as
// series ids, nothing personal; the most recent MOST_TOLD. Storage that refuses (a private window,
// blocked site data) keeps it in memory for this page instead.

const KEY = 'ballbattle.endingsTold';
export const MOST_TOLD = 20;

/** The page's session storage (`window.sessionStorage`); tests give their own. */
export interface SessionStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ToldEndings {
  has(id: string): boolean;
  add(id: string): void;
}

export function createToldEndings(store: () => SessionStore): ToldEndings {
  let ids: string[] = [];
  try {
    const kept: unknown = JSON.parse(store().getItem(KEY) ?? '[]');
    if (Array.isArray(kept)) ids = kept.filter((id): id is string => typeof id === 'string');
  } catch {
    // Unreadable or refused: start empty.
  }
  return {
    has: (id) => ids.includes(id),
    add(id) {
      if (ids.includes(id)) return;
      ids = [...ids, id].slice(-MOST_TOLD);
      try {
        store().setItem(KEY, JSON.stringify(ids));
      } catch {
        // Refused: told for this page only.
      }
    },
  };
}

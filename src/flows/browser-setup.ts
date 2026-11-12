// Runs before every browser test file: the files of a project share one origin, and so one
// `localStorage`. A series saved by one flow (ADR 0042) must not be put back in the next one's page.
import { SERIES_LENGTH_STORAGE_KEY } from '../app/series-length.ts';
import { SERIES_SETUP_STORAGE_KEY, SERIES_STORAGE_KEY } from '../app/series-save.ts';

// The remembered series length too (ADR 0048): Other modes opens on Best of 3 in every file.
for (const key of [SERIES_STORAGE_KEY, SERIES_SETUP_STORAGE_KEY, SERIES_LENGTH_STORAGE_KEY]) {
  window.localStorage.removeItem(key);
}

// This device's first-series state (first-series.ts), one for the page: home, the series setup and
// the series read and change the same answer, as they share the browser's storage.
import { createFirstSeries } from './first-series.ts';
import { browserStorage } from './storage.ts';

export const firstSeries = createFirstSeries(browserStorage);

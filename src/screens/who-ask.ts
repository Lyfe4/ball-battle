// Who this device plays as (`/me`, who-am-i.ts), asked for the page's one who source: an account
// that has played online is past the guided first series on any device (ADR 0090 addendum).
import type { PlayerResponse } from '../api/session.ts';
import { callApi } from '../app/api.ts';
import { firstSeries } from '../app/first-series-device.ts';
import { browserStorage } from '../app/storage.ts';
import { whoAmI, type WhoAmI } from '../app/who-am-i.ts';

export const askMe = (): Promise<WhoAmI> =>
  whoAmI(
    browserStorage,
    document.cookie,
    () => callApi<PlayerResponse>('GET', 'me'),
    () => {
      firstSeries.skip();
    },
  );

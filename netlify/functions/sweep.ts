import type { Config } from '@netlify/functions';
import { alsoWhileOff, endpoint, json } from '../../src/server/http.ts';
import { sweep } from '../../src/server/sweep.ts';

// It runs with vs Friend switched off too: the 90-day cleanup never waits on the switch (ADR 0078).
export default endpoint(
  'sweep',
  alsoWhileOff(async (_, { deps }) => json(200, await sweep(deps))),
);

export const config: Config = { schedule: '*/15 * * * *' };

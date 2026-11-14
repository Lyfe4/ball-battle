import type { Config } from '@netlify/functions';
import { endpoint, json } from '../../src/server/http.ts';
import { sweep } from '../../src/server/sweep.ts';

export default endpoint('sweep', async (_, { deps }) => json(200, await sweep(deps)));

export const config: Config = { schedule: '*/15 * * * *' };

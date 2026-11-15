import type { Config } from '@netlify/functions';
import { endpoint } from '../../src/server/http.ts';
import { seriesOne } from '../../src/server/routes/series.ts';

export default endpoint('series.one', seriesOne);

export const config: Config = {
  path: [
    '/api/v1/series/:id',
    '/api/v1/series/:id/picks',
    '/api/v1/series/:id/forfeit',
    '/api/v1/series/:id/rematch',
  ],
};

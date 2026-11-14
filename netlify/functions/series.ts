import type { Config } from '@netlify/functions';
import { endpoint } from '../../src/server/http.ts';
import { seriesList } from '../../src/server/routes/series.ts';

export default endpoint('series.list', seriesList);

export const config: Config = { path: '/api/v1/series', method: 'GET' };

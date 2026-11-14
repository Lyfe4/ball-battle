import type { Config } from '@netlify/functions';
import { endpoint } from '../../src/server/http.ts';
import { health } from '../../src/server/routes/health.ts';

export default endpoint('health', health);

export const config: Config = { path: '/api/v1/health', method: 'GET' };

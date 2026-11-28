import type { Config } from '@netlify/functions';
import { endpoint } from '../../src/server/http.ts';
import { clientError } from '../../src/server/routes/client-error.ts';

export default endpoint('client.error', clientError);

export const config: Config = { path: '/api/v1/client-error', method: 'POST' };

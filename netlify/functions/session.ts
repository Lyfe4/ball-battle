import type { Config } from '@netlify/functions';
import { endpoint } from '../../src/server/http.ts';
import { session } from '../../src/server/routes/session.ts';

export default endpoint('session', session);

export const config: Config = { path: '/api/v1/session' };

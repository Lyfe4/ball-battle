import type { Config } from '@netlify/functions';
import { endpoint } from '../../src/server/http.ts';
import { me } from '../../src/server/routes/me.ts';

export default endpoint('me', me);

export const config: Config = { path: '/api/v1/me' };

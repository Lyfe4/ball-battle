import type { Config } from '@netlify/functions';
import { endpoint } from '../../src/server/http.ts';
import { meMatch } from '../../src/server/routes/me.ts';

export default endpoint('me.match', meMatch);

export const config: Config = { path: '/api/v1/me/match' };

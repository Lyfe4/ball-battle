import type { Config } from '@netlify/functions';
import { endpoint } from '../../src/server/http.ts';
import { meUsername } from '../../src/server/routes/me.ts';

export default endpoint('me.username', meUsername);

export const config: Config = { path: '/api/v1/me/username' };

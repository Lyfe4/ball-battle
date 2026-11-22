import type { Config } from '@netlify/functions';
import { endpoint } from '../../src/server/http.ts';
import { meInbox } from '../../src/server/routes/me.ts';

export default endpoint('me.inbox', meInbox);

export const config: Config = { path: '/api/v1/me/inbox' };

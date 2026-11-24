import type { Config } from '@netlify/functions';
import { endpoint } from '../../src/server/http.ts';
import { friendOne } from '../../src/server/routes/friends.ts';

export default endpoint('friends.one', friendOne);

export const config: Config = {
  path: [
    '/api/v1/friends/:id',
    '/api/v1/friends/:id/accept',
    '/api/v1/friends/:id/block',
    '/api/v1/friends/:id/unblock',
    '/api/v1/friends/:id/report',
  ],
};

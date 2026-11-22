import type { Config } from '@netlify/functions';
import { endpoint } from '../../src/server/http.ts';
import { challengeOne } from '../../src/server/routes/challenges.ts';

export default endpoint('challenges.one', challengeOne);

export const config: Config = {
  path: [
    '/api/v1/challenges/:token',
    '/api/v1/challenges/:token/accept',
    '/api/v1/challenges/:token/cancel',
    '/api/v1/challenges/:token/decline',
  ],
};

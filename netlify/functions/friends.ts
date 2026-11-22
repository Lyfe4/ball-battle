import type { Config } from '@netlify/functions';
import { endpoint } from '../../src/server/http.ts';
import { friends } from '../../src/server/routes/friends.ts';

export default endpoint('friends', friends);

export const config: Config = { path: '/api/v1/friends' };

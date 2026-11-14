import type { Config } from '@netlify/functions';
import { endpoint } from '../../src/server/http.ts';
import { challenges } from '../../src/server/routes/challenges.ts';

export default endpoint('challenges.create', challenges);

export const config: Config = { path: '/api/v1/challenges' };

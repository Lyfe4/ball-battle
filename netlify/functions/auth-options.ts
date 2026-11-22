import type { Config } from '@netlify/functions';
import { endpoint } from '../../src/server/http.ts';
import { authOptions } from '../../src/server/routes/auth.ts';

export default endpoint('auth.options', authOptions);

export const config: Config = { path: '/api/v1/auth/options' };

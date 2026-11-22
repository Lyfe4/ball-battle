import type { Config } from '@netlify/functions';
import { endpoint } from '../../src/server/http.ts';
import { authSwitch } from '../../src/server/routes/auth.ts';

export default endpoint('auth.switch', authSwitch);

export const config: Config = { path: '/api/v1/auth/switch' };

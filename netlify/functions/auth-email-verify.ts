import type { Config } from '@netlify/functions';
import { endpoint } from '../../src/server/http.ts';
import { authEmailVerify } from '../../src/server/routes/auth.ts';

export default endpoint('auth.email-verify', authEmailVerify);

export const config: Config = { path: '/api/v1/auth/email/verify' };

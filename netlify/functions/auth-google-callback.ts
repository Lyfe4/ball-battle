import type { Config } from '@netlify/functions';
import { endpoint } from '../../src/server/http.ts';
import { authGoogleCallback } from '../../src/server/routes/auth.ts';

export default endpoint('auth.google-callback', authGoogleCallback);

export const config: Config = { path: '/api/v1/auth/google/callback' };

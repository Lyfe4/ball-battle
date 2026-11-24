import type { Config } from '@netlify/functions';
import { endpoint } from '../../src/server/http.ts';
import { mePoke } from '../../src/server/routes/poke.ts';

export default endpoint('me.poke', mePoke);

export const config: Config = { path: '/api/v1/me/poke' };

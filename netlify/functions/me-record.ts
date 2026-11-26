import type { Config } from '@netlify/functions';
import { endpoint } from '../../src/server/http.ts';
import { meRecord } from '../../src/server/routes/record.ts';

export default endpoint('me.record', meRecord);

export const config: Config = { path: '/api/v1/me/record' };

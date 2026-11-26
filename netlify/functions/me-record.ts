import type { Config } from '@netlify/functions';
import { endpoint } from '../../src/server/http.ts';
import { meRecordRoutes } from '../../src/server/routes/record.ts';

export default endpoint('me.record', meRecordRoutes);

export const config: Config = { path: ['/api/v1/me/record', '/api/v1/me/matches'] };

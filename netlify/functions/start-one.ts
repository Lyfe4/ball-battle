import type { Config } from '@netlify/functions';
import { endpoint } from '../../src/server/http.ts';
import { startOne } from '../../src/server/routes/starts.ts';

export default endpoint('starts.one', startOne);

export const config: Config = {
  path: ['/api/v1/starts/:id'],
};

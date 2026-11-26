// A live friend match, two phones, end to end (ADR 0053), by Realtime poke (ADR 0082): the other's
// pick arrives by poke. The suite is `describeLiveMatch` in live-match-support.ts, shared with
// live-match-blocked.online.test.ts (the socket blocked).
import { describeLiveMatch } from './live-match-support.ts';

describeLiveMatch({
  socket: 'by poke',
  blocked: false,
  base: process.env['ONLINE_BASE_URL'] ?? 'http://localhost:8888',
  engine: process.env['ONLINE_ENGINE'],
});

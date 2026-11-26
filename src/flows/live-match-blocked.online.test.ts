// A live friend match, two phones, end to end (ADR 0053), with the socket blocked (ADR 0082): the
// page reads on its timers alone. The suite is `describeLiveMatch` in live-match-support.ts, shared
// with live-match.online.test.ts (by poke).
import { describeLiveMatch } from './live-match-support.ts';

describeLiveMatch({
  socket: 'with the socket blocked',
  blocked: true,
  base: process.env['ONLINE_BASE_URL'] ?? 'http://localhost:8888',
  engine: process.env['ONLINE_ENGINE'],
});

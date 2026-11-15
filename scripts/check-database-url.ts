// `node scripts/check-database-url.ts`: checks the DATABASE_URL in your shell's environment the way
// the functions use it, and prints only facts about it, never a value: its shape (host, port, user
// form, whether a password is there and needs escaping) and what one `select 1` as that role says.
// Paste the value into the environment yourself, so it never lands in a file or your shell history:
//   PowerShell: $env:DATABASE_URL = Read-Host -MaskInput; node scripts/check-database-url.ts
import { databaseFor } from '../src/server/db.ts';
import { failureOf } from '../src/server/failure.ts';

const raw = process.env['DATABASE_URL'];
if (raw === undefined || raw.trim() === '') {
  console.error('DATABASE_URL is not set in this shell.');
  process.exit(1);
}
let url: URL;
try {
  url = new URL(raw.trim());
} catch {
  console.error('DATABASE_URL is not a valid URL: check for a password with @ : / # ? or %.');
  process.exit(1);
}
const password = url.password;
const user = decodeURIComponent(url.username);
const facts = [
  `scheme: ${url.protocol}`,
  `host: ${url.hostname}`,
  `port: ${url.port || '(none: 5432)'}`,
  `user: ${user.replace(/\.[a-z0-9]{20}$/, '.<project ref>')}`,
  `password present: ${password === '' ? 'no' : 'yes'}`,
  `password still has [ or ] from a template: ${/%5B|%5D|\[|\]/.test(password) ? 'yes' : 'no'}`,
  `surrounding whitespace: ${raw === raw.trim() ? 'no' : 'yes'}`,
];
if (url.hostname.endsWith('pooler.supabase.com') && !/\.[a-z0-9]{20}$/.test(user)) {
  facts.push('warning: through the pooler the user must be game_api.<project ref>');
}
if (url.hostname.startsWith('db.') && url.hostname.endsWith('.supabase.co')) {
  facts.push('warning: the direct host is IPv6-only and unreachable from Netlify: use the pooler');
}
if (url.port === '5432' && url.hostname.endsWith('pooler.supabase.com')) {
  facts.push('note: port 5432 is the session pooler; the functions are meant for 6543');
}
console.log(facts.join('\n'));

const sql = databaseFor(raw.trim());
try {
  await sql`select 1`;
  console.log('select 1: ok');
} catch (error) {
  console.log(`select 1 failed: ${failureOf(error, 'database')}`);
} finally {
  await sql.end({ timeout: 1 });
}

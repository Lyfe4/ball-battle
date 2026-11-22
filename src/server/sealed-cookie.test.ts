import { describe, expect, it } from 'vitest';
import { configOf } from './config.ts';
import { openCookie, sealCookie } from './sealed-cookie.ts';

const settings = {
  BALLBATTLE_ONLINE: '1',
  DATABASE_URL: 'postgres://game_api:secret@db.example/postgres',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
  SUPABASE_SECRET_KEY: 'sb_secret_x',
  SEED_KEYS: JSON.stringify({ k: Buffer.alloc(32, 1).toString('base64') }),
};
const config = configOf(settings);
const other = configOf({
  ...settings,
  SEED_KEYS: JSON.stringify({ k: Buffer.alloc(32, 2).toString('base64') }),
});
if (config === undefined || other === undefined) throw new Error('no config');

const NOW = 1_800_000_000_000;
const NAME = '__Host-bb_x';

const valueOf = (setCookie: string) =>
  setCookie.slice(setCookie.indexOf('=') + 1, setCookie.indexOf(';'));

const asked = (cookie: string) =>
  new Request('https://ballbattle.test/', { headers: { Cookie: cookie } });

describe('a sealed cookie (ADR 0079)', () => {
  it('is __Host-, HttpOnly, Secure, SameSite=Lax and 10 minutes', async () => {
    const line = await sealCookie(config, NAME, { a: 1 }, NOW);
    for (const part of [
      `${NAME}=`,
      'Path=/',
      'HttpOnly',
      'Secure',
      'SameSite=Lax',
      'Max-Age=600',
    ]) {
      expect(line).toContain(part);
    }
  });

  it('opens what it sealed until it expires', async () => {
    const value = valueOf(await sealCookie(config, NAME, { a: 'b' }, NOW));
    const request = asked(`${NAME}=${value}`);
    expect(await openCookie(config, request, NAME, NOW + 599_000)).toMatchObject({ a: 'b' });
    expect(await openCookie(config, request, NAME, NOW + 600_000)).toBeUndefined();
  });

  it('refuses one altered, under another name, or sealed with another key', async () => {
    const value = valueOf(await sealCookie(config, NAME, { a: 'b' }, NOW));
    const [body = '', mac = ''] = value.split('.');
    const altered = Buffer.from(JSON.stringify({ a: 'c', x: NOW + 1e6 })).toString('base64url');
    const open = (cookie: string, name = NAME, key = config) =>
      openCookie(key, asked(cookie), name, NOW);
    expect(await open(`${NAME}=${altered}.${mac}`)).toBeUndefined();
    expect(await open(`__Host-bb_y=${value}`, '__Host-bb_y')).toBeUndefined();
    expect(await open(`${NAME}=${value}`, NAME, other)).toBeUndefined();
    expect(await open(`${NAME}=${body}`)).toBeUndefined();
    expect(await open(`${NAME}=${value}`)).toMatchObject({ a: 'b' });
  });
});

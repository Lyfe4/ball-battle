// `pnpm build:online`: a build with online play (VITE_ONLINE=1, ADR 0052), as deploy previews make
// it, for `netlify dev` and the online browser flow. Set here rather than in the script line, so it
// works in every shell.
import { build } from 'vite';
import { reportDist } from './check-bundle.ts';

process.env['VITE_ONLINE'] = '1';
await build({ logLevel: 'warn' });
reportDist(true);

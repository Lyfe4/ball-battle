// `pnpm build:online`: a build with online play and accounts (VITE_ONLINE=1, VITE_ACCOUNTS=1, ADR
// 0052, 0079), as deploy previews make
// it, for `netlify dev` and the online browser flow. Set here rather than in the script line, so it
// works in every shell.
import { build } from 'vite';
import { reportDist } from './check-bundle.ts';

process.env['VITE_ONLINE'] = '1';
// With accounts (ADR 0079), as deploy previews and the main branch deploy are built.
process.env['VITE_ACCOUNTS'] = '1';
// With the Realtime poke (ADR 0082), on locally and in tests.
process.env['VITE_POKE'] = '1';
// With play by turns to a friend (ADR 0085), as previews and staging are built.
process.env['VITE_TURNS'] = '1';
await build({ logLevel: 'warn' });
reportDist(true, true, true, true);

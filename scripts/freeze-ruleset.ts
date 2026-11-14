// `pnpm ruleset:freeze`: freezes today's sim as rulesets/r<N>/ (ADR 0051 option 2, ADR 0052
// "Rulesets"). A series is pinned to the ruleset it was created under, and one played by turns
// lasts days, so a later ruleset must not void it: the server (and a client watching an older
// series) loads that ruleset's own bundle. Each folder holds:
// - sim.mjs: src/sim/index.ts bundled into one self-contained ES module;
// - golden.json: that ruleset's known match results (ADR 0023), which CI replays against it
//   (src/golden/frozen-rulesets.slow.test.ts).
// Run it after `pnpm golden` in the commit that bumps RULESET_VERSION. It refuses to overwrite a
// bundle: a frozen ruleset is committed once and never rebuilt, since newer tools building an old
// commit don't promise the same bytes.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { RULESET_VERSION } from '../src/sim/ruleset.ts';

const root = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const folder = root(`rulesets/r${String(RULESET_VERSION)}`);
const bundle = `${folder}/sim.mjs`;
const golden = root('src/golden/golden-matches.json');

if (existsSync(bundle)) {
  console.error(
    `rulesets/r${String(RULESET_VERSION)} is already frozen; frozen rulesets are never rebuilt.`,
  );
  process.exit(1);
}
const record = JSON.parse(readFileSync(golden, 'utf8')) as { ruleset?: unknown };
if (record.ruleset !== RULESET_VERSION) {
  console.error(
    `golden-matches.json is for ruleset ${String(record.ruleset)}: run pnpm golden first.`,
  );
  process.exit(1);
}

mkdirSync(folder, { recursive: true });
await build({
  configFile: false,
  publicDir: false,
  logLevel: 'warn',
  build: {
    outDir: folder,
    emptyOutDir: false,
    target: 'es2023',
    // Readable, so a reviewer can diff two frozen rulesets.
    minify: false,
    sourcemap: false,
    lib: { entry: root('src/sim/index.ts'), formats: ['es'], fileName: () => 'sim.mjs' },
  },
});
const banner =
  `// BallBattle's sim at ruleset ${String(RULESET_VERSION)}, frozen by \`pnpm ruleset:freeze\` ` +
  '(ADR 0052). Generated: never edit.\n';
writeFileSync(bundle, banner + readFileSync(bundle, 'utf8'));
copyFileSync(golden, `${folder}/golden.json`);
console.log(`Froze ruleset ${String(RULESET_VERSION)} to rulesets/r${String(RULESET_VERSION)}/`);

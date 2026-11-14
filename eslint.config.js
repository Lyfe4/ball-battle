// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const ADR = 'See docs/decisions/0001-deterministic-simulation.md.';

/** Math functions whose results are not guaranteed bit-identical across JS engines. */
const NON_DETERMINISTIC_MATH = [
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'sinh',
  'cosh',
  'tanh',
  'exp',
  'expm1',
  'log',
  'log1p',
  'log2',
  'log10',
  'pow',
  'cbrt',
  'hypot',
];

/** Globals that are non-deterministic or belong to the browser, never the sim. */
const SIM_BANNED_GLOBALS = [
  'Date',
  'performance',
  'setTimeout',
  'setInterval',
  'requestAnimationFrame',
  'window',
  'document',
  'navigator',
  'crypto',
  'globalThis',
];

/** An import pattern that leaves src/sim from a file at that depth. */
function leavesSim(group) {
  return {
    group: [group],
    message: `src/sim must not import anything outside it: no app, UI, rendering or wiring. ${ADR}`,
  };
}

/**
 * Code a server shares (src/api, src/server) reaches the sim only through its entry file, so a
 * frozen ruleset bundle (built from src/sim/index.ts) can stand in for it (ADR 0051, 0052). `up` is
 * the import text from a file's folder back to src/. The contract (src/api) may import neither the
 * server nor anything else of the app; the server may also import the contract.
 */
function sharedWithServer(up, { server }) {
  const allowed = [String.raw`sim/index\.ts$`, 'api/', ...(server ? ['server/'] : [])];
  return {
    regex: `^${up.replaceAll('.', String.raw`\.`)}(?!${allowed.join('|')})`,
    message:
      'src/api and src/server import the sim only through src/sim/index.ts, and nothing of the ' +
      'app (src/api not even src/server). See docs/decisions/0052-backend.md, section 7.',
  };
}

export default defineConfig(
  { ignores: ['dist', 'coverage'] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.js'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Keeps files small enough to review; split a module before it grows past this.
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    files: ['eslint.config.js', 'vite.config.ts', 'scripts/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // Plain JS config files are not part of any tsconfig, so skip type-aware rules.
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/sim/**', 'src/server/**'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['src/server/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: `Use the seeded PRNG in src/sim/rng.ts. ${ADR}`,
        },
        ...NON_DETERMINISTIC_MATH.map((property) => ({
          object: 'Math',
          property,
          message: `Math.${property} is not guaranteed identical across engines. ${ADR}`,
        })),
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "BinaryExpression[operator='**']",
          message: `The ** operator has the same cross-engine latitude as Math.pow. ${ADR}`,
        },
        {
          selector: "AssignmentExpression[operator='**=']",
          message: `The **= operator has the same cross-engine latitude as Math.pow. ${ADR}`,
        },
      ],
      'no-restricted-globals': [
        'error',
        ...SIM_BANNED_GLOBALS.map((name) => ({
          name,
          message: `src/sim must be pure and deterministic. ${ADR}`,
        })),
      ],
    },
  },
  // Nothing outside src/sim may be imported by it: a server runs the sim on its own (ADR 0022), and
  // tsconfig.sim.json only catches an outside import that happens to use the DOM. Patterns match the
  // import text, so the ban counts the levels up to src/sim from each depth of folder.
  {
    files: ['src/sim/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [leavesSim('../**')] }] },
  },
  {
    files: ['src/sim/*/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [leavesSim('../../**')] }] },
  },
  {
    files: ['src/api/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [sharedWithServer('../', { server: false })] },
      ],
    },
  },
  {
    files: ['src/server/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [sharedWithServer('../', { server: true })] }],
    },
  },
  {
    files: ['src/server/*/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [sharedWithServer('../../', { server: true })] },
      ],
    },
  },
  // The client never imports the server (ADR 0052): its secrets and Node code stay off the page.
  {
    files: ['src/**/*.ts'],
    ignores: ['src/sim/**', 'src/api/**', 'src/server/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/server/**'],
              message: 'The client never imports src/server (docs/decisions/0052-backend.md).',
            },
          ],
        },
      ],
    },
  },
  prettier,
);

// The Netlify CLI calls the vs Friend switch makes (ADR 0068), kept apart so a test can check them.
import { execFileSync } from 'node:child_process';

export const SITE_ID = 'd2fa333e-9a60-4b58-a3d2-c8a673b2ae9f';

// On Windows the CLI is a `netlify.cmd` shim, which Node runs only through cmd.exe. cmd.exe drops
// double quotes and reads & | < > ^ % ( ) and spaces as its own, so JSON (`--data {"site_id":…}`)
// arrived as `{site_id:…}` and the switch failed halfway. Every argument is plain instead.
const PLAIN = /^[\w.:=/-]+$/;

/** Whether `arg` reaches the CLI unchanged through cmd.exe as well as without a shell. */
export function isPlainArgument(arg: string): boolean {
  return PLAIN.test(arg);
}

/** The CLI calls that switch vs Friend: set or unset the variable, then a production build. */
export function switchCalls(
  wanted: 'on' | 'off',
): readonly [setVariable: readonly string[], triggerBuild: readonly string[]] {
  return [
    wanted === 'on'
      ? ['env:set', 'BALLBATTLE_ONLINE', '1', '--context', 'production']
      : ['env:unset', 'BALLBATTLE_ONLINE', '--context', 'production'],
    // Netlify's "Trigger deploy" (createSiteBuild): a fresh build of the production branch.
    ['deploy', '--trigger', '--site', SITE_ID],
  ];
}

/** Runs the Netlify CLI and returns its output; refuses an argument a shell could change. */
export function netlify(args: readonly string[]): string {
  const changed = args.find((arg) => !isPlainArgument(arg));
  if (changed !== undefined)
    throw new Error(`Not a plain argument for the Netlify CLI: ${changed}`);
  return execFileSync('netlify', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
}

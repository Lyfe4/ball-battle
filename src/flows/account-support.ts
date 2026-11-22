// Accounts in the online flows (ADR 0079): an email code read from the local Supabase's mail
// catcher (Mailpit) and typed into the real page.
import type { Page } from 'playwright';

/** The local Supabase's mail catcher (`supabase start`), where every code is sent. */
const MAILPIT = 'http://127.0.0.1:54324';

/** How many emails `email` has had. */
export async function mailCount(email: string): Promise<number> {
  const query = encodeURIComponent(`to:"${email}"`);
  const body = (await (await fetch(`${MAILPIT}/api/v1/search?query=${query}`)).json()) as {
    messages?: { ID: string }[];
  };
  return body.messages?.length ?? 0;
}

/** The code in `email`'s newest email, once there are more than `before`. */
export async function codeFor(email: string, before: number): Promise<string> {
  const deadline = Date.now() + 15_000;
  for (;;) {
    const query = encodeURIComponent(`to:"${email}"`);
    const { messages = [] } = (await (
      await fetch(`${MAILPIT}/api/v1/search?query=${query}`)
    ).json()) as { messages?: { ID: string }[] };
    const newest = messages[0];
    if (messages.length > before && newest !== undefined) {
      const message = (await (await fetch(`${MAILPIT}/api/v1/message/${newest.ID}`)).json()) as {
        Text: string;
      };
      const code = /\b\d{6}\b/.exec(message.Text)?.[0];
      if (code !== undefined) return code;
    }
    if (Date.now() > deadline) throw new Error(`No code for ${email}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/**
 * Types `email`, sends a code, reads it from the mail catcher and types it, until `then` (the
 * username's question for an account without one, else signed in) shows.
 */
export async function signInWith(
  page: Page,
  email: string,
  then = 'You’re signed in',
): Promise<void> {
  const before = await mailCount(email);
  await page.getByLabel('Your email').fill(email);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await page.getByRole('heading', { name: 'Check your email' }).waitFor();
  await page.getByLabel('The code').fill(await codeFor(email, before));
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('heading', { name: then }).waitFor();
}

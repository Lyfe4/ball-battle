// The local mail catcher (Mailpit, part of `supabase start`): where Auth's sign-in codes land in
// the database tests (ADR 0079). Each test uses addresses of its own.

const base = (): string => {
  const url = process.env['TEST_MAILPIT_URL'];
  if (url === undefined) throw new Error('No mail catcher: start Supabase without -x mailpit');
  return url;
};

interface Message {
  readonly ID: string;
}

async function messagesTo(email: string): Promise<readonly Message[]> {
  const query = encodeURIComponent(`to:"${email}"`);
  const response = await fetch(`${base()}/api/v1/search?query=${query}`);
  const body = (await response.json()) as { messages?: Message[] };
  return body.messages ?? [];
}

/** A new address for one test. */
export const newEmail = (): string =>
  `player-${crypto.randomUUID().slice(0, 12)}@example.com`.toLowerCase();

/** How many emails `email` has had. */
export const mailCount = async (email: string): Promise<number> => (await messagesTo(email)).length;

/** The code in the email `email` gets after its `before`th, waiting for it to arrive. */
export async function nextCode(email: string, before = 0): Promise<string> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const messages = await messagesTo(email);
    const newest = messages[0];
    if (messages.length > before && newest !== undefined) {
      const message = (await (await fetch(`${base()}/api/v1/message/${newest.ID}`)).json()) as {
        Text: string;
      };
      const code = /\b\d{6}\b/.exec(message.Text)?.[0];
      if (code === undefined) throw new Error('An email without a code');
      return code;
    }
    if (Date.now() > deadline) throw new Error(`No email to ${email}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** A code that isn't `code`. */
export const otherThan = (code: string): string => (code === '000000' ? '111111' : '000000');

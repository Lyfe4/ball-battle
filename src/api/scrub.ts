// What leaves for the error service (2026-11-28 audit; the page's reports, launch eve): no email
// address, database value, code, token, quoted text or URL query, however an error's message or
// stack came to hold one. The server's own reports use `scrubbed`; a page's report goes through
// `pageScrubbed` on the page and again on the server, since a page's error can quote anything a
// player typed or a link held.

/**
 * An error's message as it leaves: an email address or a `(key)=(value)` pair (a database detail)
 * is replaced, and it is cut at 300 characters, so a message that quotes what a player sent (a
 * JSON parse error, say) carries none of it.
 */
export function scrubbed(message: string): string {
  return message
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '<email>')
    .replace(/\)=\([^)]*\)/g, ')=(…)')
    .slice(0, 300);
}

/**
 * A URL's query and fragment (a link's start id, a sign-in step) are dropped; its path stays, and
 * so does a stack frame's `:line:column` after it.
 */
function withoutQueries(text: string): string {
  return text.replace(
    /(\b[a-z][\w+.-]*:\/\/[^\s?#"'`()]*)[?#][^\s"'`()]*?(?=:\d+:\d+(?:$|[\s)])|[\s"'`()]|$)/gim,
    '$1',
  );
}

/**
 * Anything a person could have written or been sent, gone from a page's error text: quoted text
 * (a username, what was typed), runs of 4 or more digits (an email code, a friend code), long
 * tokens (an id, a key, a session), and URL queries; then `scrubbed`'s rules and cut.
 */
export function pageScrubbed(message: string): string {
  return scrubbed(
    withoutQueries(
      message
        .slice(0, 2000)
        .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '<email>')
        .replace(/"[^"]*"|'[^']*'|“[^”]*”|‘[^’]*’|`[^`]*`/g, '"…"'),
    )
      .replace(/[A-Za-z0-9_-]{20,}/g, '<token>')
      .replace(/\d{4,}/g, '<n>'),
  );
}

/** A page's stack, scrubbed line by line and kept short: 20 frames, the API's body limit. */
export function pageStackScrubbed(stack: string): string {
  return stack
    .split('\n')
    .slice(0, 20)
    .map((line) =>
      withoutQueries(line.slice(0, 200))
        .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '<email>')
        .replace(/[A-Za-z0-9_-]{20,}/g, '<token>'),
    )
    .join('\n')
    .slice(0, 2500);
}

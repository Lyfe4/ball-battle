// Which app's own browser a page is open in, when it says so (ADR 0053, a live match's smoothness).
// A link opened from a chat or social app often opens inside that app, in a web view that carries
// the app's own scripts and settings; a live match plays more smoothly in the phone's browser, and
// the guest made there is the one that plays (each browser keeps its own cookie), so the friend's
// card suggests it before Accept. Only apps that name themselves in the user agent are known: an
// app that opens links in Safari's own view (Messages, WhatsApp, Discord) is Safari, and says nothing.

export interface InAppBrowser {
  /** The app, as its players call it ("Instagram"), or "an app" for an unnamed web view. */
  readonly app: string;
  /** An iPhone or iPad: the phone's browser is Safari. */
  readonly ios: boolean;
}

/** User agent tokens, most specific first (Messenger's also names Facebook). */
const APPS: readonly (readonly [RegExp, string])[] = [
  [/FBAN\/Messenger|MessengerForiOS|FB_IAB\/MESSENGER/i, 'Messenger'],
  [/Instagram/, 'Instagram'],
  [/FBAN|FBAV|FB_IAB|FBIOS/, 'Facebook'],
  [/BytedanceWebview|musical_ly|TikTok/i, 'TikTok'],
  [/Snapchat/, 'Snapchat'],
  [/ Line\//, 'LINE'],
  [/LinkedInApp/, 'LinkedIn'],
  [/Twitter/, 'X'],
  [/MicroMessenger/, 'WeChat'],
];

export function inAppBrowserOf(userAgent: string): InAppBrowser | undefined {
  const ios = /iPhone|iPad|iPod/.test(userAgent);
  const named = APPS.find(([token]) => token.test(userAgent));
  if (named !== undefined) return { app: named[1], ios };
  // Android's in-app web views mark themselves "wv".
  if (userAgent.includes('Android') && userAgent.includes('; wv)'))
    return { app: 'an app', ios: false };
  return undefined;
}

/** The friend's card's line, before Accept. */
export function inAppLine(browser: InAppBrowser): string {
  const where = browser.app === 'an app' ? 'inside an app' : `inside ${browser.app}`;
  const open = browser.ios ? 'Safari' : 'your browser';
  return `You opened this ${where}. For the smoothest game, open the link in ${open} first.`;
}

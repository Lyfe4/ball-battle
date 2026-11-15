import { describe, expect, it } from 'vitest';
import { inAppBrowserOf, inAppLine } from './in-app-browser.ts';

const IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22B83';
const SAFARI = `${IOS.replace(' Mobile/22B83', '')} Version/18.1 Mobile/15E148 Safari/604.1`;
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko)';

describe('the browser a link was opened in', () => {
  it('knows the apps that name themselves', () => {
    expect(
      inAppBrowserOf(`${IOS} Instagram 350.0.0.0 (iPhone15,3; iOS 18_1; en_AU)`),
    ).toStrictEqual({
      app: 'Instagram',
      ios: true,
    });
    expect(inAppBrowserOf(`${IOS} [FBAN/MessengerForiOS;FBAV/480.0]`)?.app).toBe('Messenger');
    expect(inAppBrowserOf(`${IOS} [FBAN/FBIOS;FBAV/480.0]`)?.app).toBe('Facebook');
    expect(
      inAppBrowserOf(`${ANDROID}; wv) Chrome/130.0 Mobile Safari/537.36 musical_ly_2023`)?.app,
    ).toBe('TikTok');
    expect(inAppBrowserOf(`${IOS} Snapchat/13.10.0.40`)?.app).toBe('Snapchat');
  });

  it('calls an unnamed Android web view an app', () => {
    expect(
      inAppBrowserOf(
        `${ANDROID.replace('Pixel 8)', 'Pixel 8; wv)')} Chrome/130.0 Mobile Safari/537.36`,
      ),
    ).toStrictEqual({ app: 'an app', ios: false });
  });

  it('says nothing in a browser, or in Safari’s own view inside an app', () => {
    expect(inAppBrowserOf(SAFARI)).toBeUndefined();
    expect(inAppBrowserOf(`${ANDROID} Chrome/130.0 Mobile Safari/537.36`)).toBeUndefined();
    expect(
      inAppBrowserOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36'),
    ).toBeUndefined();
  });

  it('suggests Safari on an iPhone and the browser elsewhere', () => {
    expect(inAppLine({ app: 'Instagram', ios: true })).toBe(
      'You opened this inside Instagram. For the smoothest game, open the link in Safari first.',
    );
    expect(inAppLine({ app: 'an app', ios: false })).toBe(
      'You opened this inside an app. For the smoothest game, open the link in your browser first.',
    );
  });
});

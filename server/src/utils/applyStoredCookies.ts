import type { Page } from 'puppeteer';
import SocialCookie, { type SocialPlatform } from '../models/SocialCookie';
import { decryptCookieList } from './cookieEncryption';

/**
 * Apply stored auth cookies (imported via the browser extension) to a Puppeteer page
 * before navigation, so that subsequent requests are authenticated as the user.
 *
 * Returns true if cookies were applied, false otherwise.
 */
export async function applyStoredCookies(
  page: Page,
  userId: string,
  platform: SocialPlatform
): Promise<boolean> {
  try {
    const record = await SocialCookie.findOne({
      userId,
      platform,
      webCookiesEncrypted: { $ne: null },
    }).select('webCookiesEncrypted').lean();
    if (!record?.webCookiesEncrypted) return false;

    const cookies = decryptCookieList(record.webCookiesEncrypted);
    if (cookies.length === 0) return false;

    // Filter expired cookies
    const now = Math.floor(Date.now() / 1000);
    const valid = cookies.filter((c) => !c.expirationDate || c.expirationDate > now);
    if (valid.length === 0) return false;

    // Map sameSite values that Puppeteer expects: 'Strict' | 'Lax' | 'None'
    const normalize = (v?: string): 'Strict' | 'Lax' | 'None' | undefined => {
      if (!v) return undefined;
      const s = v.toLowerCase();
      if (s === 'strict') return 'Strict';
      if (s === 'lax' || s === 'unspecified' || s === 'no_restriction') return 'Lax';
      if (s === 'none') return 'None';
      return undefined;
    };

    await page.setCookie(
      ...valid.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        secure: !!c.secure,
        httpOnly: !!c.httpOnly,
        sameSite: normalize(c.sameSite),
        ...(c.expirationDate ? { expires: c.expirationDate } : {}),
      }))
    );

    // Touch the lastUsedAt timestamp without awaiting
    SocialCookie.updateOne(
      { userId, platform },
      { $set: { 'whatsappWebSession.lastUsedAt': new Date() } }
    ).catch(() => { /* best effort */ });

    return true;
  } catch (err) {
    console.warn('[applyStoredCookies]', platform, err instanceof Error ? err.message : err);
    return false;
  }
}

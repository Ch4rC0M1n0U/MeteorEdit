/// <reference lib="dom" />
import { Page } from 'puppeteer';
import { ProfileData } from './types';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function scrape(page: Page, url: string): Promise<ProfileData> {
  const result: ProfileData = {
    platform: 'paypal',
    username: '',
    displayName: '',
    bio: '',
    profileImageUrl: '',
    stats: {},
    registrationDate: null,
    extraImages: [],
    rawMetadata: {},
  };

  try {
    // Extract username from URL (paypal.me/username or paypal.com/paypalme/username)
    const usernameMatch = url.match(/paypal\.me\/([^/?#]+)/i)
      || url.match(/paypalme\/([^/?#]+)/i);
    if (usernameMatch) {
      result.username = usernameMatch[1];
    }

    // Normalize URL to paypal.com/paypalme/ format (paypal.me redirects there)
    const normalizedUrl = result.username
      ? `https://www.paypal.com/paypalme/${result.username}`
      : url;

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    // Intercept API responses (PayPal loads profile data via internal API)
    const apiResponses: any[] = [];
    const responseHandler = async (response: any) => {
      try {
        const rUrl = response.url();
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('application/json') && (rUrl.includes('paypalme') || rUrl.includes('profile') || rUrl.includes('user'))) {
          const json = await response.json().catch(() => null);
          if (json) apiResponses.push({ url: rUrl, data: json });
        }
      } catch { }
    };

    page.on('response', responseHandler);

    // PayPal is a heavy SPA — use domcontentloaded + manual wait for render
    await page.goto(normalizedUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    // Wait for the SPA to render profile content
    await page.waitForSelector('h1', { timeout: 15000 }).catch(() => {});
    await delay(4000);

    // Check if profile exists (404 page)
    const is404 = await page.evaluate(() => {
      const text = document.body.innerText || '';
      return text.includes('page you\'re looking for') || text.includes('page introuvable')
        || text.includes('doesn\'t exist') || text.includes('n\'existe pas')
        || document.title.includes('404');
    });

    if (is404) {
      result.rawMetadata.error = 'Profil PayPal introuvable';
      page.off('response', responseHandler);
      return result;
    }

    // Extra wait for SPA content to fully render
    await delay(2000);

    // ── Extract from intercepted API responses ──
    for (const entry of apiResponses) {
      const data = entry.data;
      try {
        // Search recursively for user profile data
        const findProfile = (obj: any, depth: number = 0): any => {
          if (depth > 8 || !obj || typeof obj !== 'object') return null;
          // PayPal profile patterns
          if (obj.displayName && (obj.avatarUrl || obj.profilePhoto || obj.avatar)) return obj;
          if (obj.name && obj.profileImage) return obj;
          if (obj.first_name && obj.last_name) return obj;
          for (const key of Object.keys(obj)) {
            const found = findProfile(obj[key], depth + 1);
            if (found) return found;
          }
          return null;
        };

        const profile = findProfile(data);
        if (profile) {
          result.displayName = profile.displayName || profile.name
            || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || result.displayName;
          result.profileImageUrl = profile.avatarUrl || profile.profilePhoto || profile.avatar
            || profile.profileImage || result.profileImageUrl;
          if (profile.bio || profile.description) result.bio = profile.bio || profile.description;
          if (profile.city || profile.location) result.rawMetadata.location = profile.city || profile.location;
          if (profile.country) result.rawMetadata.country = profile.country;
        }
      } catch { }
    }

    // ── DOM extraction (primary source since PayPal is client-rendered) ──
    const domData = await page.evaluate(() => {
      // Display name — typically in h1
      let displayName = '';
      const h1 = document.querySelector('h1');
      if (h1) displayName = h1.textContent?.trim() || '';

      // Username (@handle) — scan visible text near the name area
      let username = '';
      // PayPal renders username as a separate element near the name
      const allElements = Array.from(document.querySelectorAll('span, p, div'));
      for (const el of allElements) {
        const text = el.textContent?.trim() || '';
        // Match @username pattern (short text, starts with @)
        if (text.match(/^@[A-Za-z0-9_.-]+$/) && text.length < 40) {
          username = text;
          break;
        }
      }

      // Country code — scan for short 2-letter country codes near the profile area
      let country = '';
      for (const el of allElements) {
        const text = el.textContent?.trim() || '';
        // Country codes are usually 2 uppercase letters alone in their element
        if (text.match(/^[A-Z]{2}$/) && el.children.length === 0) {
          // Verify it's not a random abbreviation by checking parent context
          const parent = el.parentElement;
          const parentText = parent?.textContent?.trim() || '';
          // Should be near user info (short parent text, not in nav/footer)
          if (parentText.length < 100 && !el.closest('nav, footer, header')) {
            country = text;
            break;
          }
        }
      }

      // Profile picture — PayPal uses div[role="img"] with background-image
      let profilePic = '';
      // Strategy 1: div[role="img"] with aria-label containing "profil" or "profile"
      const profileDiv = document.querySelector('div[role="img"][aria-label*="profil" i], div[role="img"][aria-label*="profile" i]');
      if (profileDiv) {
        const style = window.getComputedStyle(profileDiv);
        const bg = style.backgroundImage || '';
        if (bg && bg !== 'none' && bg.includes('url(')) {
          const urlMatch = bg.match(/url\(["']?([^"')]+)["']?\)/);
          if (urlMatch) profilePic = urlMatch[1];
        }
      }
      // Strategy 2: any div[role="img"] with a background-image
      if (!profilePic) {
        const roleDivs = Array.from(document.querySelectorAll('div[role="img"]'));
        for (const div of roleDivs) {
          const style = window.getComputedStyle(div);
          const bg = style.backgroundImage || '';
          if (bg && bg !== 'none' && bg.includes('url(')) {
            const urlMatch = bg.match(/url\(["']?([^"')]+)["']?\)/);
            if (urlMatch && !urlMatch[1].includes('paypalobjects') && !urlMatch[1].includes('logo')) {
              profilePic = urlMatch[1];
              break;
            }
          }
        }
      }
      // Strategy 3: img tags as fallback
      if (!profilePic) {
        const imgs = Array.from(document.querySelectorAll('img'));
        for (const img of imgs) {
          const src = img.src || '';
          const alt = (img.alt || '').toLowerCase();
          if (!src || src.includes('paypalobjects') || src.includes('logo') || src.includes('icon')
            || src.includes('favicon') || src.includes('svg') || src.includes('data:image')) continue;
          if (alt.includes('profile') || alt.includes('avatar') || alt.includes('profil')) {
            profilePic = src;
            break;
          }
        }
      }

      // Cover/banner image — check CSS background images on large containers
      let coverUrl = '';
      // Also check wide img tags
      if (!coverUrl) {
        const containers = Array.from(document.querySelectorAll('div'));
        for (const div of containers) {
          const style = window.getComputedStyle(div);
          const bg = style.backgroundImage || '';
          if (bg && bg !== 'none' && bg.includes('url(') && div.offsetWidth > 300 && div.offsetHeight > 80) {
            const urlMatch = bg.match(/url\(["']?([^"')]+)["']?\)/);
            if (urlMatch && !urlMatch[1].includes('paypalobjects') && !urlMatch[1].includes('gradient')) {
              coverUrl = urlMatch[1];
              break;
            }
          }
        }
      }

      // Meta tags
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
      const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';

      // External links
      const links: string[] = [];
      const allLinks = Array.from(document.querySelectorAll('a[href]'));
      for (const a of allLinks) {
        const href = a.getAttribute('href') || '';
        if (href && !href.includes('paypal') && !href.includes('javascript') && !href.includes('#')
          && (href.startsWith('http') || href.startsWith('www'))) {
          links.push(href);
        }
      }

      return { displayName, profilePic, coverUrl, username, country, ogTitle, ogDesc, ogImage, links: [...new Set(links)] };
    });

    console.log(`[PayPal] DOM: name="${domData.displayName}", username="${domData.username}", country="${domData.country}", pic=${!!domData.profilePic}`);

    // Apply DOM data — prefer DOM over API intercepts for PayPal
    if (domData.displayName) result.displayName = domData.displayName;
    // Fallback: extract name from og:title ("Payez Anne JORIS avec PayPal.Me" → "Anne JORIS")
    if (!result.displayName && domData.ogTitle) {
      const ogMatch = domData.ogTitle.match(/(?:Payez|Pay)\s+(.+?)\s+(?:avec|with)\s+PayPal/i);
      if (ogMatch) result.displayName = ogMatch[1].trim();
      else result.displayName = domData.ogTitle.replace(/\s*[-|].*PayPal.*/i, '').trim();
    }

    if (domData.username) result.username = domData.username.replace(/^@/, '');
    if (domData.country) result.rawMetadata.country = domData.country;

    if (domData.profilePic) result.profileImageUrl = domData.profilePic;
    // Don't fall back to ogImage — it's usually the PayPal logo

    if (domData.coverUrl) {
      result.extraImages.push(domData.coverUrl);
      result.rawMetadata.coverPhotoUrl = domData.coverUrl;
    }
    if (domData.links.length > 0) {
      result.rawMetadata.externalUrl = domData.links[0];
      if (domData.links.length > 1) result.rawMetadata.externalUrls = domData.links;
    }

    // PayPal.me canonical URL
    result.rawMetadata.paypalUrl = normalizedUrl;

    page.off('response', responseHandler);

    console.log(`[PayPal] API responses intercepted: ${apiResponses.length}`);
    console.log(`[PayPal] Final: name="${result.displayName}", username="${result.username}", country="${result.rawMetadata.country || ''}", pic=${!!result.profileImageUrl}`);

  } catch (error: any) {
    console.error(`[PayPal] Error:`, error.message);
    result.rawMetadata.error = error.message || 'Unknown error';
  }

  return result;
}

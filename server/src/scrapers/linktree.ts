/// <reference lib="dom" />
import { Page } from 'puppeteer';
import { ProfileData } from './types';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function scrape(page: Page, url: string): Promise<ProfileData> {
  const result: ProfileData = {
    platform: 'linktree',
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
    // Extract username from URL
    const usernameMatch = url.match(/linktr\.ee\/([^/?#]+)/i);
    if (usernameMatch) {
      result.username = usernameMatch[1];
    }

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2000);

    // ── Extract __NEXT_DATA__ (Linktree uses Next.js) ──
    const nextData = await page.evaluate(() => {
      try {
        const el = document.getElementById('__NEXT_DATA__');
        if (el?.textContent) return JSON.parse(el.textContent);
      } catch { }
      return null;
    });

    if (nextData) {
      const pageProps = nextData.props?.pageProps;
      console.log(`[Linktree] __NEXT_DATA__ found, pageProps keys: ${JSON.stringify(Object.keys(pageProps || {}))}`);

      if (pageProps) {
        // ── Profile info ──
        result.displayName = pageProps.pageTitle || pageProps.account?.pageTitle || '';
        result.username = pageProps.username || pageProps.account?.username || result.username;
        result.bio = pageProps.description || pageProps.account?.description || '';
        result.profileImageUrl = pageProps.profilePictureUrl || pageProps.account?.profilePictureUrl || '';

        // Verified
        if (pageProps.isProfileVerified || pageProps.account?.isProfileVerified) {
          result.rawMetadata.verified = true;
        }

        // Account tier (free/pro)
        const tier = pageProps.account?.tier || pageProps.tier;
        if (tier) result.rawMetadata.accountTier = tier;

        // Dates (Linktree uses millisecond timestamps)
        const createdAt = pageProps.account?.createdAt || pageProps.createdAt;
        if (createdAt) {
          const ts = typeof createdAt === 'number' ? createdAt : parseInt(createdAt);
          result.registrationDate = new Date(ts).toISOString();
        }
        const updatedAt = pageProps.account?.updatedAt || pageProps.updatedAt;
        if (updatedAt) {
          const ts = typeof updatedAt === 'number' ? updatedAt : parseInt(updatedAt);
          result.rawMetadata.lastUpdated = new Date(ts).toISOString();
        }

        // ── Links (the core of Linktree) ──
        const links = pageProps.links || pageProps.account?.links || [];
        console.log(`[Linktree] links count: ${links.length}, first link sample: ${JSON.stringify(links[0] || {}).substring(0, 300)}`);
        if (links.length > 0) {
          const parsedLinks: Array<{ title: string; url: string; type: string; active: boolean }> = [];
          for (const link of links) {
            const linkUrl = link.url || link.link || link.href || '';
            const linkTitle = link.title || link.name || link.label || '';
            if (!linkUrl && !linkTitle) continue;
            parsedLinks.push({
              title: linkTitle,
              url: linkUrl,
              type: link.type || 'link',
              active: link.locked !== true,
            });
          }
          result.rawMetadata.links = parsedLinks;
          result.stats.links = parsedLinks.filter(l => l.active).length;
        }

        // ── Social links (Instagram, TikTok, YouTube, etc.) ──
        const socialLinks = pageProps.socialLinks || pageProps.account?.socialLinks || [];
        if (socialLinks.length > 0) {
          result.rawMetadata.socialLinks = socialLinks.map((sl: any) => ({
            type: sl.type || '',
            url: sl.url || '',
          }));

          // Set primary external URL (first social link)
          if (socialLinks.length > 0) {
            result.rawMetadata.externalUrl = socialLinks[0].url;
            if (socialLinks.length > 1) {
              result.rawMetadata.externalUrls = socialLinks.map((sl: any) => sl.url).filter(Boolean);
            }
          }

          // Extract email if exposed
          const emailLink = socialLinks.find((sl: any) => sl.type === 'email_address' || sl.type === 'email');
          if (emailLink?.url) {
            result.rawMetadata.email = emailLink.url.replace(/^mailto:/i, '');
          }
        }

        // ── Tracking pixels (OSINT: reveals other web properties) ──
        if (pageProps.account?.googleAnalyticsId) {
          result.rawMetadata.googleAnalyticsId = pageProps.account.googleAnalyticsId;
        }
        if (pageProps.account?.facebookPixelId) {
          result.rawMetadata.facebookPixelId = pageProps.account.facebookPixelId;
        }
        if (pageProps.account?.tiktokPixelId) {
          result.rawMetadata.tiktokPixelId = pageProps.account.tiktokPixelId;
        }

        // Sensitive content warning
        if (pageProps.account?.hasSensitiveContent) {
          result.rawMetadata.sensitiveContent = true;
        }

        // Donations
        if (pageProps.account?.donationsActive) {
          result.rawMetadata.donationsActive = true;
        }
      }
    }

    // ── DOM fallbacks ──
    if (!result.displayName) {
      result.displayName = await page.evaluate(() => {
        return document.querySelector('h1, [data-testid="profile-title"]')?.textContent?.trim() || '';
      });
    }

    if (!result.bio) {
      result.bio = await page.evaluate(() => {
        return document.querySelector('[data-testid="profile-description"]')?.textContent?.trim()
          || document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
      });
    }

    if (!result.profileImageUrl) {
      result.profileImageUrl = await page.evaluate(() => {
        return document.querySelector('[data-testid="profile-image"] img, img[alt*="profile"]')?.getAttribute('src')
          || document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
      });
    }

    // DOM fallback for links if __NEXT_DATA__ didn't have them
    if (!result.rawMetadata.links || result.rawMetadata.links.length === 0) {
      const domLinks = await page.evaluate(() => {
        const links: Array<{ title: string; url: string }> = [];
        const linkElements = document.querySelectorAll('[data-testid*="LinkButton"] a, [data-testid*="StyledContainer"] a');
        for (const el of Array.from(linkElements)) {
          const href = el.getAttribute('href') || '';
          const title = el.textContent?.trim() || '';
          if (href && !href.includes('linktr.ee')) {
            links.push({ title, url: href });
          }
        }
        return links;
      });
      if (domLinks.length > 0) {
        result.rawMetadata.links = domLinks;
        result.stats.links = domLinks.length;
      }
    }

    console.log(`[Linktree] Final: name="${result.displayName}", links=${result.rawMetadata.links?.length || 0}, socialLinks=${result.rawMetadata.socialLinks?.length || 0}`);

  } catch (error: any) {
    console.error(`[Linktree] Error:`, error.message);
    result.rawMetadata.error = error.message || 'Unknown error';
  }

  return result;
}

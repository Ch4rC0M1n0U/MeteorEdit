/// <reference lib="dom" />
import { Page } from 'puppeteer-core';
import { ProfileData } from './types';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const randomDelay = () => delay(1000 + Math.random() * 2000);

export async function scrape(page: Page, url: string): Promise<ProfileData> {
  const result: ProfileData = {
    platform: 'tiktok',
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
    const usernameMatch = url.match(/tiktok\.com\/@([^/?#]+)/i);
    if (usernameMatch) {
      result.username = usernameMatch[1];
    }

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    );

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await randomDelay();

    // Extract __UNIVERSAL_DATA_FOR_REHYDRATION__ from script tags
    const universalData = await page.evaluate(() => {
      try {
        // Method 1: Direct window variable
        if ((window as any).__UNIVERSAL_DATA_FOR_REHYDRATION__) {
          return (window as any).__UNIVERSAL_DATA_FOR_REHYDRATION__;
        }
        // Method 2: Search script tags
        const scripts = Array.from(document.querySelectorAll('script'));
        for (const script of scripts) {
          const text = script.textContent || '';
          if (text.includes('__UNIVERSAL_DATA_FOR_REHYDRATION__')) {
            const match = text.match(/window\['__UNIVERSAL_DATA_FOR_REHYDRATION__'\]\s*=\s*({.+});/s)
              || text.match(/__UNIVERSAL_DATA_FOR_REHYDRATION__\s*=\s*({.+});/s);
            if (match) {
              return JSON.parse(match[1]);
            }
          }
        }
        // Method 3: SIGI_STATE (older TikTok)
        if ((window as any).SIGI_STATE) {
          return (window as any).SIGI_STATE;
        }
        // Method 4: __NEXT_DATA__
        const nextData = document.querySelector('#__NEXT_DATA__');
        if (nextData?.textContent) {
          return JSON.parse(nextData.textContent);
        }
        return null;
      } catch {
        return null;
      }
    });

    if (universalData) {

      // Navigate the data structure to find user info
      // TikTok stores it under __DEFAULT_SCOPE__['webapp.user-detail']
      const userModule = universalData.__DEFAULT_SCOPE__?.['webapp.user-detail']
        || universalData.UserModule
        || universalData.props?.pageProps;

      if (userModule) {
        const userInfo = userModule.userInfo?.user
          || userModule.users?.[result.username]
          || userModule.userData;

        if (userInfo) {
          result.username = userInfo.uniqueId || result.username;
          result.displayName = userInfo.nickname || '';
          result.bio = userInfo.signature || '';
          result.profileImageUrl = userInfo.avatarLarger || userInfo.avatarMedium || userInfo.avatarThumb || '';

          if (userInfo.createTime) {
            const date = new Date(userInfo.createTime * 1000);
            result.registrationDate = date.toISOString();
          }

          // Extra images from avatar variants
          if (userInfo.avatarLarger && userInfo.avatarMedium && userInfo.avatarLarger !== userInfo.avatarMedium) {
            result.extraImages.push(userInfo.avatarMedium);
          }

          // External links (Instagram, YouTube, etc.) — important for OSINT pivoting
          let bioLink = userInfo.bioLink?.link || userInfo.bioLink?.url || '';
          // Clean TikTok redirect URLs: extract real URL from ?target= parameter
          if (bioLink.includes('tiktok.com/link/') && bioLink.includes('target=')) {
            try {
              const targetParam = new URL(bioLink).searchParams.get('target');
              if (targetParam) bioLink = targetParam;
            } catch { }
          }
          if (bioLink) {
            result.rawMetadata.externalUrl = bioLink;
          }

          // Verified / private / region
          if (userInfo.verified) result.rawMetadata.verified = true;
          if (userInfo.privateAccount) result.rawMetadata.privateAccount = true;
          if (userInfo.region) result.rawMetadata.region = userInfo.region;
          if (userInfo.language) result.rawMetadata.language = userInfo.language;
          if (userInfo.openFavorite) result.rawMetadata.openFavorite = true;
          if (userInfo.commentSetting != null) result.rawMetadata.commentSetting = userInfo.commentSetting;
          if (userInfo.duetSetting != null) result.rawMetadata.duetSetting = userInfo.duetSetting;
          if (userInfo.stitchSetting != null) result.rawMetadata.stitchSetting = userInfo.stitchSetting;
          if (userInfo.isUnderAge18) result.rawMetadata.isUnderAge18 = true;
        }

        const userStats = userModule.userInfo?.stats
          || userModule.stats?.[result.username];

        if (userStats) {
          result.stats.followers = userStats.followerCount ?? '';
          result.stats.following = userStats.followingCount ?? '';
          result.stats.likes = userStats.heartCount ?? userStats.heart ?? '';
          result.stats.videos = userStats.videoCount ?? '';
          result.stats.diggCount = userStats.diggCount ?? '';
        }
      }
    }

    await randomDelay();

    // DOM fallback for visible stats
    if (!result.displayName || Object.keys(result.stats).length === 0) {
      const domData = await page.evaluate(() => {
        const displayName = document.querySelector('[data-e2e="user-subtitle"], [class*="ShareTitle"] h1, h1[data-e2e="user-title"]')?.textContent?.trim() || '';
        const bio = document.querySelector('[data-e2e="user-bio"], [class*="ShareDesc"]')?.textContent?.trim() || '';
        const profileImg = document.querySelector('[data-e2e="user-avatar"] img, [class*="ImgAvatar"] img')?.getAttribute('src') || '';

        const stats: Record<string, string> = {};
        const followerEl = document.querySelector('[data-e2e="followers-count"], [title*="Follower"]');
        if (followerEl) stats.followers = followerEl.textContent?.trim() || '';
        const followingEl = document.querySelector('[data-e2e="following-count"], [title*="Following"]');
        if (followingEl) stats.following = followingEl.textContent?.trim() || '';
        const likesEl = document.querySelector('[data-e2e="likes-count"], [title*="Like"]');
        if (likesEl) stats.likes = likesEl.textContent?.trim() || '';

        return { displayName, bio, profileImg, stats };
      });

      if (!result.displayName && domData.displayName) result.displayName = domData.displayName;
      if (!result.bio && domData.bio) result.bio = domData.bio;
      if (!result.profileImageUrl && domData.profileImg) result.profileImageUrl = domData.profileImg;
      if (Object.keys(result.stats).length === 0 && Object.keys(domData.stats).length > 0) {
        result.stats = domData.stats;
      }
    }

    // DOM fallback for external link
    if (!result.rawMetadata.externalUrl) {
      const externalLink = await page.evaluate(() => {
        const linkEl = document.querySelector('[data-e2e="user-link"] a, a[href*="instagram.com"], a[href*="youtube.com"], a[href*="twitter.com"], a[href*="x.com"]');
        return linkEl?.getAttribute('href') || '';
      });
      if (externalLink) result.rawMetadata.externalUrl = externalLink;
    }

    // Clean any TikTok redirect URL (works for both data source and DOM fallback)
    if (result.rawMetadata.externalUrl) {
      let extUrl = result.rawMetadata.externalUrl;
      // Method 1: URL parser
      if (extUrl.includes('tiktok.com/link')) {
        try {
          const u = new URL(extUrl);
          const target = u.searchParams.get('target');
          if (target) extUrl = target;
        } catch { }
      }
      // Method 2: regex fallback for target= parameter
      if (extUrl.includes('target=')) {
        const m = extUrl.match(/target=([^&]+)/);
        if (m) extUrl = decodeURIComponent(m[1]);
      }
      result.rawMetadata.externalUrl = extUrl;
      console.log(`[TikTok] External URL cleaned: ${result.rawMetadata.externalUrl}`);
    }

    // og:image fallback
    if (!result.profileImageUrl) {
      result.profileImageUrl = await page.evaluate(() => {
        return document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
      });
    }

  } catch (error: any) {
    result.rawMetadata.error = error.message || 'Unknown error';
  }

  return result;
}

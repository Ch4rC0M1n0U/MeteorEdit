/// <reference lib="dom" />
import { Page } from 'puppeteer-core';
import { ProfileData } from './types';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const randomDelay = () => delay(1000 + Math.random() * 2000);

export async function scrape(page: Page, url: string): Promise<ProfileData> {
  const result: ProfileData = {
    platform: 'x-twitter',
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
    // Extract username from URL (supports both twitter.com and x.com)
    const usernameMatch = url.match(/(?:twitter|x)\.com\/([^/?#]+)/i);
    if (usernameMatch && !['home', 'explore', 'search', 'settings', 'i', 'intent'].includes(usernameMatch[1])) {
      result.username = usernameMatch[1];
    }

    // Intercept API responses for user data
    let userApiData: any = null;
    const responseHandler = async (response: any) => {
      try {
        const responseUrl = response.url();
        if (
          responseUrl.includes('UserByScreenName') ||
          responseUrl.includes('UserResultByScreenName') ||
          responseUrl.includes('UserByRestId') ||
          responseUrl.includes('/users/by')
        ) {
          const json = await response.json().catch(() => null);
          if (json) {
            userApiData = json;
          }
        }
      } catch {
        // Ignore response parsing errors
      }
    };

    page.on('response', responseHandler);

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    );

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await randomDelay();

    // Wait a bit for API responses
    await delay(2000);

    // Parse intercepted API response
    if (userApiData) {
      result.rawMetadata.apiData = userApiData;

      // Navigate the nested response structure
      const userResult = userApiData.data?.user?.result
        || userApiData.data?.user_result?.result
        || userApiData.data?.user;

      if (userResult) {
        const legacy = userResult.legacy || userResult;
        const core = userResult.core?.user_results?.result?.legacy || legacy;

        result.displayName = legacy.name || core.name || '';
        result.username = legacy.screen_name || core.screen_name || result.username;
        result.bio = legacy.description || core.description || '';

        // Profile image URL - replace _normal with _400x400 for higher resolution
        let profileImgUrl = legacy.profile_image_url_https || core.profile_image_url_https || '';
        if (profileImgUrl) {
          // Store original (normal) as extra
          result.extraImages.push(profileImgUrl);
          // Get high-res version
          profileImgUrl = profileImgUrl.replace('_normal', '_400x400');
          result.profileImageUrl = profileImgUrl;
        }

        // Banner image
        const bannerUrl = legacy.profile_banner_url || core.profile_banner_url;
        if (bannerUrl) {
          result.extraImages.push(bannerUrl);
          result.rawMetadata.bannerUrl = bannerUrl;
        }

        // Stats
        result.stats.followers = legacy.followers_count ?? core.followers_count ?? '';
        result.stats.following = legacy.friends_count ?? core.friends_count ?? '';
        result.stats.tweets = legacy.statuses_count ?? core.statuses_count ?? '';
        result.stats.likes = legacy.favourites_count ?? core.favourites_count ?? '';
        result.stats.listed = legacy.listed_count ?? core.listed_count ?? '';
        result.stats.mediaCount = legacy.media_count ?? core.media_count ?? '';

        // Registration date
        if (legacy.created_at || core.created_at) {
          result.registrationDate = legacy.created_at || core.created_at;
        }

        // Additional metadata
        result.rawMetadata.verified = legacy.verified || core.verified || false;
        result.rawMetadata.isBlueVerified = userResult.is_blue_verified || false;
        result.rawMetadata.location = legacy.location || core.location || '';
        result.rawMetadata.website = legacy.url || core.url || '';
        result.rawMetadata.pinnedTweetIds = legacy.pinned_tweet_ids_str || [];
        result.rawMetadata.profileInterstitialType = legacy.profile_interstitial_type || '';

        // Entities (expanded URLs in bio)
        if (legacy.entities?.description?.urls) {
          result.rawMetadata.bioUrls = legacy.entities.description.urls.map((u: any) => ({
            display: u.display_url,
            expanded: u.expanded_url,
          }));
        }
      }
    }

    await randomDelay();

    // DOM fallback if API interception didn't work
    if (!result.displayName) {
      const domData = await page.evaluate(() => {
        // Display name
        const nameEl = document.querySelector('[data-testid="UserName"] div span, [data-testid="UserDescription"]');
        const displayName = document.querySelector('[data-testid="UserName"]')?.querySelector('span')?.textContent?.trim() || '';

        // Bio
        const bioEl = document.querySelector('[data-testid="UserDescription"]');
        const bio = bioEl?.textContent?.trim() || '';

        // Profile image
        const profileImg = document.querySelector('[data-testid="UserAvatar"] img, a[href$="/photo"] img');
        const profileImageUrl = (profileImg as HTMLImageElement)?.src || '';

        // Stats from visible elements
        const stats: Record<string, string> = {};
        const followingLink = document.querySelector('a[href$="/following"]');
        const followersLink = document.querySelector('a[href$="/verified_followers"], a[href$="/followers"]');
        if (followingLink) {
          const num = followingLink.textContent?.match(/([\d,.KkMm]+)/);
          if (num) stats.following = num[1];
        }
        if (followersLink) {
          const num = followersLink.textContent?.match(/([\d,.KkMm]+)/);
          if (num) stats.followers = num[1];
        }

        // Join date
        const joinDateEl = document.querySelector('[data-testid="UserJoinDate"]');
        const joinDate = joinDateEl?.textContent?.trim() || '';

        return { displayName, bio, profileImageUrl, stats, joinDate };
      });

      if (domData.displayName && !result.displayName) result.displayName = domData.displayName;
      if (domData.bio && !result.bio) result.bio = domData.bio;
      if (domData.profileImageUrl && !result.profileImageUrl) {
        result.profileImageUrl = domData.profileImageUrl.replace('_normal', '_400x400');
      }
      if (Object.keys(domData.stats).length > 0 && Object.keys(result.stats).length === 0) {
        result.stats = domData.stats;
      }
      if (domData.joinDate && !result.registrationDate) {
        result.registrationDate = domData.joinDate;
      }
    }

    // og:image fallback
    if (!result.profileImageUrl) {
      result.profileImageUrl = await page.evaluate(() => {
        return document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
      });
    }

    page.off('response', responseHandler);
  } catch (error: any) {
    result.rawMetadata.error = error.message || 'Unknown error';
  }

  return result;
}

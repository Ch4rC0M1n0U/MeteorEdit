/// <reference lib="dom" />
import { Page } from 'puppeteer-core';
import { ProfileData } from './types';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const randomDelay = () => delay(1000 + Math.random() * 2000);

export async function scrape(page: Page, url: string): Promise<ProfileData> {
  const result: ProfileData = {
    platform: 'instagram',
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
    const usernameMatch = url.match(/instagram\.com\/([^/?#]+)/i);
    if (usernameMatch && !['p', 'reel', 'reels', 'stories', 'explore', 'accounts', 'direct', 'tv'].includes(usernameMatch[1])) {
      result.username = usernameMatch[1];
    }

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    // ── Strategy 1: Intercept API responses while loading ──
    let apiUserData: any = null;
    const responseHandler = async (response: any) => {
      try {
        const responseUrl = response.url();
        // Instagram web_profile_info API
        if (responseUrl.includes('/api/v1/users/web_profile_info/') ||
            responseUrl.includes('/api/v1/users/') && responseUrl.includes('/info/')) {
          const json = await response.json().catch(() => null);
          if (json) apiUserData = json;
        }
        // GraphQL user query
        if (responseUrl.includes('/graphql/query/') || responseUrl.includes('/api/graphql')) {
          const text = await response.text().catch(() => '');
          if (text && text.includes('user') && (text.includes('biography') || text.includes('edge_followed_by'))) {
            try {
              const json = JSON.parse(text);
              if (!apiUserData) apiUserData = json;
            } catch { }
          }
        }
      } catch { }
    };

    page.on('response', responseHandler);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await randomDelay();

    // ── Strategy 2: Try direct API call if we have cookies (authenticated) ──
    if (!apiUserData && result.username) {
      try {
        const apiResponse = await page.evaluate(async (username: string) => {
          try {
            const resp = await fetch(`/api/v1/users/web_profile_info/?username=${username}`, {
              headers: {
                'X-IG-App-ID': '936619743392459',
                'X-Requested-With': 'XMLHttpRequest',
              },
              credentials: 'include',
            });
            if (resp.ok) return await resp.json();
          } catch { }
          return null;
        }, result.username);

        if (apiResponse) apiUserData = apiResponse;
      } catch { }
    }

    // ── Parse API response ──
    if (apiUserData) {
      // Navigate to user object (could be nested in different ways)
      const user = apiUserData.data?.user
        || apiUserData.user
        || apiUserData.graphql?.user
        || apiUserData.data?.user_result?.result;

      if (user) {
        result.rawMetadata.apiUser = user;
        result.displayName = user.full_name || '';
        result.username = user.username || result.username;
        result.bio = user.biography || user.bio || '';
        result.profileImageUrl = user.profile_pic_url_hd || user.hd_profile_pic_url_info?.url || user.profile_pic_url || '';

        // HD profile pic versions
        if (user.hd_profile_pic_versions && Array.isArray(user.hd_profile_pic_versions)) {
          const largest = user.hd_profile_pic_versions.reduce((a: any, b: any) =>
            (a.width || 0) > (b.width || 0) ? a : b
          );
          if (largest.url) result.profileImageUrl = largest.url;
        }

        // Stats
        result.stats.followers = user.edge_followed_by?.count ?? user.follower_count ?? '';
        result.stats.following = user.edge_follow?.count ?? user.following_count ?? '';
        result.stats.posts = user.edge_owner_to_timeline_media?.count ?? user.media_count ?? '';

        // Registration / creation
        if (user.date_joined) result.registrationDate = user.date_joined;

        // Additional metadata
        if (user.is_verified) result.rawMetadata.verified = true;
        if (user.is_private != null) result.rawMetadata.isPrivate = user.is_private;
        if (user.is_business_account) result.rawMetadata.isBusiness = true;
        if (user.business_category_name) result.rawMetadata.businessCategory = user.business_category_name;
        if (user.category_name) result.rawMetadata.category = user.category_name;
        if (user.external_url) result.rawMetadata.website = user.external_url;
        if (user.pk || user.id) result.rawMetadata.userId = user.pk || user.id;
        if (user.fbid) result.rawMetadata.facebookId = user.fbid;
        if (user.connected_fb_page) result.rawMetadata.connectedFbPage = user.connected_fb_page;
        if (user.pronouns && user.pronouns.length > 0) result.rawMetadata.pronouns = user.pronouns;
        if (user.bio_links && user.bio_links.length > 0) {
          result.rawMetadata.bioLinks = user.bio_links.map((l: any) => ({
            title: l.title || '',
            url: l.url || l.lynx_url || '',
          }));
        }
        if (user.biography_with_entities?.entities) {
          result.rawMetadata.bioEntities = user.biography_with_entities.entities;
        }
        if (user.mutual_followers_count) result.rawMetadata.mutualFollowers = user.mutual_followers_count;

        // Profile picture as extra image
        if (user.profile_pic_url && user.profile_pic_url !== result.profileImageUrl) {
          result.extraImages.push(user.profile_pic_url);
        }
      }
    }

    // ── Strategy 3: Parse embedded page data ──
    if (!result.displayName) {
      const pageData = await page.evaluate(() => {
        try {
          // ld+json
          const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
          for (const s of scripts) {
            try {
              const json = JSON.parse(s.textContent || '');
              if (json['@type'] === 'ProfilePage' || json.mainEntity) return json;
            } catch { }
          }

          // _sharedData
          if ((window as any)._sharedData?.entry_data?.ProfilePage) {
            return (window as any)._sharedData.entry_data.ProfilePage[0]?.graphql?.user || null;
          }

          // __initialData
          if ((window as any).__initialData?.data?.user) {
            return (window as any).__initialData.data.user;
          }

          // Search script tags for sharedData
          const allScripts = Array.from(document.querySelectorAll('script'));
          for (const script of allScripts) {
            const text = script.textContent || '';
            const m = text.match(/window\._sharedData\s*=\s*({.+?});\s*$/m);
            if (m) {
              const parsed = JSON.parse(m[1]);
              if (parsed.entry_data?.ProfilePage) {
                return parsed.entry_data.ProfilePage[0]?.graphql?.user || null;
              }
            }
          }
          return null;
        } catch { return null; }
      });

      if (pageData) {
        if (pageData['@type'] === 'ProfilePage' && pageData.mainEntity) {
          const entity = pageData.mainEntity;
          if (!result.displayName) result.displayName = entity.name || '';
          if (!result.username) result.username = entity.alternateName?.replace('@', '') || result.username;
          if (!result.bio) result.bio = entity.description || '';
          if (!result.profileImageUrl) result.profileImageUrl = entity.image || '';
          if (entity.interactionStatistic) {
            for (const stat of entity.interactionStatistic) {
              if (stat.interactionType?.includes('Follow') && !result.stats.followers) {
                result.stats.followers = stat.userInteractionCount || 0;
              }
            }
          }
        } else {
          if (!result.displayName) result.displayName = pageData.full_name || '';
          if (!result.username) result.username = pageData.username || result.username;
          if (!result.bio) result.bio = pageData.biography || '';
          if (!result.profileImageUrl) result.profileImageUrl = pageData.profile_pic_url_hd || pageData.profile_pic_url || '';
          if (!result.stats.followers) result.stats.followers = pageData.edge_followed_by?.count ?? '';
          if (!result.stats.following) result.stats.following = pageData.edge_follow?.count ?? '';
          if (!result.stats.posts) result.stats.posts = pageData.edge_owner_to_timeline_media?.count ?? '';
        }
      }
    }

    await randomDelay();

    // ── Strategy 4: DOM fallback ──
    if (!result.displayName || !result.bio) {
      const domData = await page.evaluate(() => {
        const headerName = document.querySelector('header h1, header h2, [class*="header"] span')?.textContent?.trim() || '';
        const bioEl = document.querySelector('[class*="biography"], [class*="-bio-"], header section > div > span');
        const bio = bioEl?.textContent?.trim() || '';
        const statEls = document.querySelectorAll('header section ul li, [class*="header"] [class*="count"]');
        const stats: Record<string, string> = {};
        statEls.forEach(el => {
          const text = el.textContent?.trim() || '';
          if (text.toLowerCase().includes('follower') || text.toLowerCase().includes('abonné')) {
            const num = text.match(/([\d,.KkMm]+)/);
            if (num) stats.followers = num[1];
          } else if (text.toLowerCase().includes('following') || text.toLowerCase().includes('abonnement')) {
            const num = text.match(/([\d,.KkMm]+)/);
            if (num) stats.following = num[1];
          } else if (text.toLowerCase().includes('post') || text.toLowerCase().includes('publication')) {
            const num = text.match(/([\d,.KkMm]+)/);
            if (num) stats.posts = num[1];
          }
        });
        return { displayName: headerName, bio, stats };
      });

      if (!result.displayName && domData.displayName) result.displayName = domData.displayName;
      if (!result.bio && domData.bio) result.bio = domData.bio;
      if (Object.keys(domData.stats).length > 0 && Object.keys(result.stats).length === 0) {
        result.stats = domData.stats;
      }
    }

    // og:image fallback
    if (!result.profileImageUrl) {
      result.profileImageUrl = await page.evaluate(() => {
        return document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
      });
    }

    const title = await page.title();
    if (title) result.rawMetadata.pageTitle = title;

    page.off('response', responseHandler);
  } catch (error: any) {
    result.rawMetadata.error = error.message || 'Unknown error';
  }

  return result;
}

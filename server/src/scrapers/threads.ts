/// <reference lib="dom" />
import { Page } from 'puppeteer-core';
import { ProfileData } from './types';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const randomDelay = () => delay(1000 + Math.random() * 2000);

export async function scrape(page: Page, url: string): Promise<ProfileData> {
  const result: ProfileData = {
    platform: 'threads',
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
    // Extract username
    const usernameMatch = url.match(/threads\.(?:com|net)\/@([^/?#]+)/i)
      || url.match(/threads\.(?:com|net)\/([^/?#@]+)/i);
    if (usernameMatch && !['login', 'signup', 'search', 'activity', 'settings'].includes(usernameMatch[1])) {
      result.username = usernameMatch[1].replace(/^@/, '');
    }

    // Intercept API responses
    const apiResponses: any[] = [];
    const responseHandler = async (response: any) => {
      try {
        const rUrl = response.url();
        if (rUrl.includes('/api/graphql') || rUrl.includes('threads') && response.headers()['content-type']?.includes('json')) {
          const text = await response.text().catch(() => '');
          if (text && text.length > 100) {
            const lines = text.split('\n').filter((l: string) => l.trim().startsWith('{'));
            for (const line of lines) {
              try { apiResponses.push(JSON.parse(line)); } catch { }
            }
          }
        }
      } catch { }
    };

    page.on('response', responseHandler);

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await randomDelay();
    await delay(2000);

    // ── Try direct API call (Threads uses Instagram's API internally) ──
    if (result.username) {
      try {
        const apiData = await page.evaluate(async (username: string) => {
          try {
            const resp = await fetch(`/api/graphql`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-IG-App-ID': '238260118697367',
              },
              credentials: 'include',
              body: `variables=%7B%22username%22%3A%22${username}%22%7D&doc_id=23996318473300828`,
            });
            if (resp.ok) return await resp.json();
          } catch { }
          return null;
        }, result.username);

        if (apiData) apiResponses.push(apiData);
      } catch { }
    }

    // ── Parse API responses ──
    for (const entry of apiResponses) {
      try {
        // Deep search for user objects with Threads patterns
        const findUser = (obj: any, depth: number = 0): any => {
          if (depth > 12 || !obj || typeof obj !== 'object') return null;

          // Threads user pattern
          if (obj.username && (obj.profile_pic_url || obj.hd_profile_pic_url_info || obj.biography || obj.follower_count != null)) {
            return obj;
          }
          if (obj.text_post_app_info && obj.username) return obj;

          for (const key of Object.keys(obj)) {
            const found = findUser(obj[key], depth + 1);
            if (found) return found;
          }
          return null;
        };

        const userData = findUser(entry);
        if (userData) {
          const existing = result.rawMetadata.apiUser;
          const newFields = Object.keys(userData).length;
          const existingFields = existing ? Object.keys(existing).length : 0;
          if (newFields > existingFields) {
            result.rawMetadata.apiUser = userData;
          }

          if (userData.full_name && !result.displayName) result.displayName = userData.full_name;
          if (userData.username && !result.username) result.username = userData.username;
          if (userData.biography && !result.bio) result.bio = userData.biography;

          // Profile picture
          const pic = userData.hd_profile_pic_url_info?.url || userData.profile_pic_url;
          if (pic && !result.profileImageUrl) result.profileImageUrl = pic;
          if (userData.hd_profile_pic_versions && Array.isArray(userData.hd_profile_pic_versions)) {
            const largest = userData.hd_profile_pic_versions.reduce((a: any, b: any) =>
              (a.width || 0) > (b.width || 0) ? a : b
            );
            if (largest.url) result.profileImageUrl = largest.url;
          }

          // Stats
          if (userData.follower_count != null && !result.stats.followers) result.stats.followers = userData.follower_count;
          if (userData.following_count != null && !result.stats.following) result.stats.following = userData.following_count;
          if (userData.media_count != null && !result.stats.posts) result.stats.posts = userData.media_count;
          if (userData.text_post_app_thread_count != null) result.stats.threads = userData.text_post_app_thread_count;
          if (userData.text_post_app_reply_count != null) result.stats.replies = userData.text_post_app_reply_count;

          // Cross-platform identifiers
          if (userData.is_verified != null) result.rawMetadata.verified = userData.is_verified;
          if (userData.pk || userData.pk_id) result.rawMetadata.userId = userData.pk || userData.pk_id;
          if (userData.instagram_user_id) result.rawMetadata.instagramUserId = userData.instagram_user_id;
          if (userData.fbid_v2) result.rawMetadata.facebookId = userData.fbid_v2;
          if (userData.is_private != null) result.rawMetadata.isPrivate = userData.is_private;
          if (userData.is_business != null) result.rawMetadata.isBusiness = userData.is_business;
          if (userData.account_type != null) result.rawMetadata.accountType = userData.account_type;

          // Bio links
          if (userData.bio_links && userData.bio_links.length > 0) {
            result.rawMetadata.bioLinks = userData.bio_links.map((l: any) => ({
              title: l.title || '',
              url: l.url || l.lynx_url || '',
            }));
          }

          // Bio entities
          if (userData.biography_with_entities?.entities) {
            result.rawMetadata.bioEntities = userData.biography_with_entities.entities;
          }

          // Profile context (mutual followers etc.)
          if (userData.profile_context_facepile_users) {
            result.rawMetadata.mutualFollowersCount = userData.profile_context_facepile_users.length;
          }
        }
      } catch { }
    }

    // ── JSON-LD ──
    const jsonLd = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      const results: any[] = [];
      for (const s of scripts) {
        try { results.push(JSON.parse(s.textContent || '')); } catch { }
      }
      return results;
    });

    for (const ld of jsonLd) {
      if (ld['@type'] === 'ProfilePage' || ld['@type'] === 'Person') {
        const entity = ld.mainEntity || ld;
        if (!result.displayName && entity.name) result.displayName = entity.name;
        if (!result.username && entity.alternateName) result.username = entity.alternateName.replace(/^@/, '');
        if (!result.bio && entity.description) result.bio = entity.description;
        if (!result.profileImageUrl && entity.image) result.profileImageUrl = entity.image;
        if (entity.identifier) result.rawMetadata.identifier = entity.identifier;
        if (entity.interactionStatistic) {
          for (const stat of entity.interactionStatistic) {
            const type = stat.interactionType || '';
            if ((type.includes('Follow') && stat.name === 'Follows') && !result.stats.following) {
              result.stats.following = stat.userInteractionCount || 0;
            } else if ((type.includes('Follow') && (stat.name === 'Followers' || stat.name !== 'Follows')) && !result.stats.followers) {
              result.stats.followers = stat.userInteractionCount || 0;
            }
            if ((type.includes('Write') || stat.name === 'Posts') && !result.stats.posts) {
              result.stats.posts = stat.userInteractionCount || 0;
            }
          }
        }
      }
    }

    // ── DOM fallbacks ──
    if (!result.displayName) {
      result.displayName = await page.evaluate(() => {
        return document.querySelector('h1, [class*="ProfileHeader"] h1, [class*="userName"]')?.textContent?.trim() || '';
      });
    }

    if (!result.bio) {
      result.bio = await page.evaluate(() => {
        return document.querySelector('[class*="biography"], [class*="bio"]')?.textContent?.trim() || '';
      });
    }

    if (!result.profileImageUrl) {
      result.profileImageUrl = await page.evaluate(() => {
        return document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
      });
    }

    // ── External links (Instagram, websites, etc.) ──
    // From API bio_links
    if (result.rawMetadata.bioLinks?.length > 0) {
      const links = result.rawMetadata.bioLinks
        .map((l: any) => l.url)
        .filter((u: string) => u && !u.includes('threads.net'));
      if (links.length > 0) result.rawMetadata.externalUrl = links[0];
      if (links.length > 1) result.rawMetadata.externalUrls = links;
    }

    // DOM fallback: extract visible external links (Instagram icon, website links)
    if (!result.rawMetadata.externalUrl) {
      const externalLinks = await page.evaluate(() => {
        const links: string[] = [];
        const allLinks = Array.from(document.querySelectorAll('a[href]'));
        for (const a of allLinks) {
          const href = a.getAttribute('href') || '';
          if (href.includes('instagram.com/') && !href.includes('threads.net')) {
            links.push(href);
          } else if (href.includes('youtube.com/') || href.includes('twitter.com/') || href.includes('x.com/') ||
                     href.includes('tiktok.com/') || href.includes('facebook.com/') || href.includes('linktr.ee/') ||
                     href.includes('paypal.me/')) {
            links.push(href);
          }
        }
        return [...new Set(links)];
      });
      if (externalLinks.length > 0) {
        result.rawMetadata.externalUrl = externalLinks[0];
        if (externalLinks.length > 1) result.rawMetadata.externalUrls = externalLinks;
      }
    }

    // Threads profiles are always linked to Instagram — construct the link if not found
    if (!result.rawMetadata.externalUrl && result.username) {
      result.rawMetadata.externalUrl = `https://www.instagram.com/${result.username}`;
    }

    // Meta description for stats extraction
    const metaDesc = await page.evaluate(() => {
      return document.querySelector('meta[property="og:description"]')?.getAttribute('content')
        || document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    });
    if (metaDesc && Object.keys(result.stats).length === 0) {
      const followersMatch = metaDesc.match(/([\d,.KkMm]+)\s*(?:followers?|abonnés)/i);
      const followingMatch = metaDesc.match(/([\d,.KkMm]+)\s*(?:following|abonnements)/i);
      const postsMatch = metaDesc.match(/([\d,.KkMm]+)\s*(?:posts?|publications?|threads?)/i);
      if (followersMatch) result.stats.followers = followersMatch[1];
      if (followingMatch) result.stats.following = followingMatch[1];
      if (postsMatch) result.stats.posts = postsMatch[1];
    }

    if (!result.bio && metaDesc) {
      const cleaned = metaDesc.replace(/^[\d,.KkMm]+\s+\w+,\s*/g, '').trim();
      if (cleaned.length > 5) result.bio = cleaned;
    }

    page.off('response', responseHandler);
  } catch (error: any) {
    result.rawMetadata.error = error.message || 'Unknown error';
  }

  return result;
}

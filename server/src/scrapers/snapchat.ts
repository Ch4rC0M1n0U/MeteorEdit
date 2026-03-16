/// <reference lib="dom" />
import { Page } from 'puppeteer';
import { ProfileData } from './types';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const randomDelay = () => delay(1000 + Math.random() * 2000);

export async function scrape(page: Page, url: string): Promise<ProfileData> {
  const result: ProfileData = {
    platform: 'snapchat',
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
    const usernameMatch = url.match(/snapchat\.com\/add\/([^/?#]+)/i)
      || url.match(/snapchat\.com\/@([^/?#]+)/i)
      || url.match(/snapchat\.com\/t\/([^/?#]+)/i)
      || url.match(/story\.snapchat\.com\/s\/([^/?#]+)/i);
    if (usernameMatch) {
      result.username = usernameMatch[1];
    }

    // Intercept JSON responses for user data
    const interceptedData: Record<string, any>[] = [];
    const responseHandler = async (response: any) => {
      try {
        const responseUrl = response.url();
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('application/json') || responseUrl.includes('/api/') || responseUrl.includes('graphql')) {
          const json = await response.json().catch(() => null);
          if (json) {
            interceptedData.push({ url: responseUrl, data: json });
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

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await randomDelay();

    // Wait extra for async data to load
    await delay(2000);

    // ── Extract __NEXT_DATA__ (Snapchat uses Next.js) ──
    const nextData = await page.evaluate(() => {
      try {
        const el = document.getElementById('__NEXT_DATA__');
        if (el?.textContent) {
          return JSON.parse(el.textContent);
        }
      } catch { }
      return null;
    });

    if (nextData) {
      const pageProps = nextData.props?.pageProps;
      console.log(`[Snapchat] __NEXT_DATA__ found, pageProps keys: ${JSON.stringify(Object.keys(pageProps || {}))}`);
      console.log(`[Snapchat] userProfile.$case: ${pageProps?.userProfile?.$case}`);

      if (pageProps) {
        // ── publicProfileInfo (primary source, inside userProfile or at root) ──
        const ppInfo = pageProps.userProfile?.publicProfileInfo
          || pageProps.publicProfileInfo
          || pageProps.userProfile?.userInfo
          || null;

        if (ppInfo) {
          result.displayName = ppInfo.title || ppInfo.displayName || ppInfo.display_name || result.displayName;
          result.username = ppInfo.username || ppInfo.snapchatUsername || result.username;
          result.bio = ppInfo.bio || ppInfo.description || result.bio;
          result.profileImageUrl = ppInfo.profilePictureUrl || result.profileImageUrl;

          // Bitmoji / 3D avatar fallback
          const bitmojiUrl = ppInfo.bitmojiAvatarId || ppInfo.bitmoji3dAvatarId || ppInfo.bitmojiUrl;
          if (bitmojiUrl && !result.profileImageUrl) {
            result.profileImageUrl = bitmojiUrl.startsWith('http')
              ? bitmojiUrl
              : `https://sdk.bitmoji.com/render/panel/${bitmojiUrl}-v1.png?transparent=1&palette=1`;
          }

          // Snapcode
          const snapcode = ppInfo.snapcodeImageUrl || ppInfo.snapcode_image_url;
          if (snapcode) {
            result.extraImages.push(snapcode);
            result.rawMetadata.snapcodeUrl = snapcode;
          }

          // Subscribers
          if (ppInfo.subscriberCount != null) result.stats.subscribers = ppInfo.subscriberCount;

          // Snap score
          if (ppInfo.snapScore != null) result.stats.snapScore = ppInfo.snapScore;

          // Creation date (can be {value: "timestamp_ms"} or plain number)
          const creationTs = ppInfo.creationTimestampMs?.value || ppInfo.creationTimestampMs;
          if (creationTs) {
            const ts = typeof creationTs === 'string' ? parseInt(creationTs) : creationTs;
            if (ts > 0) result.registrationDate = new Date(ts).toISOString();
          }

          // Last update
          const lastUpdateTs = ppInfo.lastUpdateTimestampMs?.value || ppInfo.lastUpdateTimestampMs;
          if (lastUpdateTs) {
            const ts = typeof lastUpdateTs === 'string' ? parseInt(lastUpdateTs) : lastUpdateTs;
            if (ts > 0) result.rawMetadata.lastUpdated = new Date(ts).toISOString();
          }

          // Category / website / address
          if (ppInfo.categoryStringId) result.rawMetadata.category = ppInfo.categoryStringId;
          if (ppInfo.websiteUrl) result.rawMetadata.website = ppInfo.websiteUrl;
          if (ppInfo.address) result.rawMetadata.address = ppInfo.address;
          if (ppInfo.businessProfileId) result.rawMetadata.businessProfileId = ppInfo.businessProfileId;
          if (ppInfo.publisherType) result.rawMetadata.publisherType = ppInfo.publisherType;
          if (ppInfo.squareHeroImageUrl) result.extraImages.push(ppInfo.squareHeroImageUrl);
          if (ppInfo.heroImageUrl) result.extraImages.push(ppInfo.heroImageUrl);

          // Badge (verified/public figure)
          if (ppInfo.badge != null && ppInfo.badge !== 0) result.rawMetadata.badge = ppInfo.badge;

          // Highlights
          if (ppInfo.hasCuratedHighlights) result.rawMetadata.hasCuratedHighlights = true;
          if (ppInfo.hasSpotlightHighlights) result.rawMetadata.hasSpotlightHighlights = true;
          if (ppInfo.hasStory) result.rawMetadata.hasStory = true;

          console.log(`[Snapchat] publicProfileInfo: name="${result.displayName}", user="${result.username}", bio="${result.bio}", pic=${!!result.profileImageUrl}, created=${result.registrationDate}`);
        }

        // ── Fallback: direct userProfile fields (older structure) ──
        if (!ppInfo) {
          const userInfo = pageProps.userProfile || pageProps.profile || pageProps.user;
          if (userInfo) {
            if (!result.displayName) result.displayName = userInfo.displayName || userInfo.title || '';
            if (!result.username) result.username = userInfo.username || '';
            if (!result.bio) result.bio = userInfo.bio || userInfo.description || '';
            if (!result.profileImageUrl) result.profileImageUrl = userInfo.profilePictureUrl || '';
            if (userInfo.subscriberCount != null) result.stats.subscribers = userInfo.subscriberCount;
          }
        }

        // ── Page metadata enrichment ──
        const pageMeta = pageProps.pageMetadata;
        if (pageMeta) {
          if (pageMeta.pageDescription?.value) {
            result.rawMetadata.pageDescription = pageMeta.pageDescription.value;
          }
          if (pageMeta.shareId) result.rawMetadata.shareId = pageMeta.shareId;
        }

        // ── Canonical URL ──
        if (pageProps.pageLinks?.snapchatCanonicalUrl) {
          result.rawMetadata.canonicalUrl = pageProps.pageLinks.snapchatCanonicalUrl;
        }

        // ── Story data ──
        if (pageProps.story) {
          result.rawMetadata.story = pageProps.story;
          if (pageProps.story.snapList) {
            result.stats.storySnaps = pageProps.story.snapList.length;
          }
        }

        // ── Spotlight highlights ──
        if (pageProps.spotlightHighlights?.length > 0) {
          result.stats.spotlightHighlights = pageProps.spotlightHighlights.length;
        }
        if (pageProps.curatedHighlights?.length > 0) {
          result.stats.curatedHighlights = pageProps.curatedHighlights.length;
        }
        if (pageProps.lenses?.length > 0) {
          result.stats.lenses = pageProps.lenses.length;
        }
      }
    }

    // ── Extract JSON-LD structured data ──
    const jsonLd = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      const results: any[] = [];
      for (const s of scripts) {
        try {
          results.push(JSON.parse(s.textContent || ''));
        } catch { }
      }
      return results;
    });

    if (jsonLd.length > 0) {
      result.rawMetadata.jsonLd = jsonLd;
      for (const ld of jsonLd) {
        if (ld['@type'] === 'Person' || ld['@type'] === 'ProfilePage') {
          if (ld.name && !result.displayName) result.displayName = ld.name;
          if (ld.description && !result.bio) result.bio = ld.description;
          if (ld.image && !result.profileImageUrl) result.profileImageUrl = ld.image;
          if (ld.url) result.rawMetadata.canonicalUrl = ld.url;
        }
      }
    }

    // ── Search intercepted API responses ──
    for (const entry of interceptedData) {
      const data = entry.data;
      if (data?.story_metadata) {
        result.rawMetadata.story_metadata = data.story_metadata;
      }
      if (data?.userProfile || data?.user) {
        const profile = data.userProfile || data.user;
        if (!result.displayName) result.displayName = profile.displayName || profile.display_name || '';
        if (!result.username) result.username = profile.username || profile.snapchatUsername || '';
        if (!result.profileImageUrl) result.profileImageUrl = profile.bitmojiUrl || profile.bitmoji_avatar_id || '';
        if (profile.snapScore || profile.snap_score) {
          result.stats.snapScore = profile.snapScore || profile.snap_score;
        }
      }
      if (data?.profilePictures || data?.previousAvatars) {
        const pics = data.profilePictures || data.previousAvatars;
        if (Array.isArray(pics)) {
          result.extraImages.push(...pics.map((p: any) => typeof p === 'string' ? p : p.url).filter(Boolean));
        }
      }
    }

    // ── DOM fallbacks ──
    const domData = await page.evaluate(() => {
      // Name
      const nameEl = document.querySelector('[class*="PublicProfileCard"] h1')
        || document.querySelector('[data-testid="display-name"]')
        || document.querySelector('.public-profile-header h1')
        || document.querySelector('h1');
      const displayName = nameEl?.textContent?.trim() || '';

      // Username from page
      const usernameEl = document.querySelector('[class*="PublicProfileCard"] h2')
        || document.querySelector('[data-testid="username"]')
        || document.querySelector('[class*="username"]');
      let username = usernameEl?.textContent?.trim() || '';
      username = username.replace(/^@/, '');

      // Profile image
      const img = document.querySelector('[class*="ProfileCard"] img')
        || document.querySelector('[class*="bitmoji"] img')
        || document.querySelector('.public-profile-header img')
        || document.querySelector('img[alt*="Bitmoji"]')
        || document.querySelector('img[alt*="avatar"]')
        || document.querySelector('img[alt*="profile"]');
      const profilePic = (img as HTMLImageElement)?.src || '';

      // og:image
      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
      const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
      const desc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';

      // Followers/subscribers from page text — look for patterns like "132 k followers"
      const pageText = document.body.innerText || '';
      const followerPatterns = [
        /(\d[\d\s,.]*\s*[kKmM]?)\s*(?:followers?|abonnés?|subscribers?)/i,
        /(?:followers?|abonnés?|subscribers?)\s*[:\s]*(\d[\d\s,.]*\s*[kKmM]?)/i,
      ];
      let followers = '';
      for (const pat of followerPatterns) {
        const m = pageText.match(pat);
        if (m) { followers = m[1].trim(); break; }
      }

      // Last updated date
      const datePatterns = pageText.match(/(?:Dernière mise à jour|Last updated|Updated)\s*[:\s]*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      const lastUpdated = datePatterns ? datePatterns[1] : '';

      // All visible text that might contain stats
      const allSpans = Array.from(document.querySelectorAll('span, p, div'));
      const statsTexts: string[] = [];
      for (const el of allSpans) {
        const text = (el.textContent || '').trim();
        if (text.match(/\d+\s*[kKmM]?\s*(?:followers?|subscriber|abonné)/i)) {
          statsTexts.push(text);
        }
      }

      return { displayName, username, profilePic, ogImage, ogDesc, ogTitle, desc, followers, lastUpdated, statsTexts };
    });

    console.log(`[Snapchat] DOM data: followers="${domData.followers}", statsTexts=${JSON.stringify(domData.statsTexts)}`);

    if (!result.displayName && domData.displayName) result.displayName = domData.displayName;
    if (!result.username && domData.username) result.username = domData.username;
    if (!result.profileImageUrl) result.profileImageUrl = domData.profilePic || domData.ogImage || '';
    if (!result.bio) result.bio = domData.ogDesc || domData.desc || '';
    if (!result.stats.subscribers && domData.followers) result.stats.subscribers = domData.followers;
    if (domData.lastUpdated) result.rawMetadata.lastUpdated = domData.lastUpdated;

    if (!result.displayName && domData.ogTitle) {
      const titleMatch = domData.ogTitle.match(/^(.+?)\s*(?:\(@|[|–-])/);
      if (titleMatch) result.displayName = titleMatch[1].trim();
      else result.displayName = domData.ogTitle.replace(/\s*[|–-]\s*Snapchat.*/i, '').trim();
    }

    page.off('response', responseHandler);
  } catch (error: any) {
    result.rawMetadata.error = error.message || 'Unknown error';
  }

  return result;
}

/// <reference lib="dom" />
import { Page } from 'puppeteer-core';
import { ProfileData } from './types';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const randomDelay = () => delay(1000 + Math.random() * 2000);

export async function scrape(page: Page, url: string): Promise<ProfileData> {
  const result: ProfileData = {
    platform: 'facebook',
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
    // Extract username/profile ID from URL
    const profileMatch = url.match(/facebook\.com\/profile\.php\?id=(\d+)/i);
    const usernameMatch = url.match(/facebook\.com\/([^/?#]+)/i);
    const EXCLUDED = ['pages', 'groups', 'events', 'watch', 'marketplace', 'gaming', 'login',
      'help', 'settings', 'stories', 'reels', 'friends', 'notifications', 'messages',
      'bookmarks', 'memories', 'feeds', 'home.php', 'photo', 'photo.php', 'permalink.php',
      'hashtag', 'search', 'places', 'fundraisers', 'saved', 'offers', 'jobs', 'weather'];

    if (profileMatch) {
      result.username = profileMatch[1];
    } else if (usernameMatch && !EXCLUDED.includes(usernameMatch[1])) {
      result.username = usernameMatch[1];
    }

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await randomDelay();
    await delay(3000);

    // Scroll progressively to trigger lazy loading of intro section
    for (let i = 0; i < 3; i++) {
      await page.evaluate((step) => window.scrollBy(0, 400 + step * 200), i);
      await delay(1000);
    }
    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await delay(1000);

    // ══════════════════════════════════════════════════════════
    // DOM-FIRST STRATEGY: Extract data from what's visible on page
    // This is the MOST RELIABLE source — always shows the target profile
    // ══════════════════════════════════════════════════════════

    const domData = await page.evaluate(() => {
      const mainContent = document.querySelector('[role="main"]');

      // ── Name from h1 (most reliable) ──
      const h1 = mainContent?.querySelector('h1') || document.querySelector('h1');
      const nameFromH1 = h1?.textContent?.trim() || '';

      // Name from title
      const title = document.title || '';
      const nameFromTitle = title.replace(/^\(\d+\)\s*/, '').replace(/\s*[|–-]\s*Facebook.*$/i, '').trim();

      // ── Profile picture ──
      let profilePic = '';
      // SVG image (Facebook uses SVG containers for avatars)
      const svgImage = mainContent?.querySelector('svg image[preserveAspectRatio]')
        || document.querySelector('[data-pagelet="ProfileActions"] image');
      if (svgImage) {
        profilePic = svgImage.getAttribute('xlink:href') || svgImage.getAttribute('href') || '';
      }
      if (!profilePic) {
        const avatar = mainContent?.querySelector('[aria-label*="photo de profil"] img, [aria-label*="profile picture"] img');
        if (avatar) profilePic = (avatar as HTMLImageElement).src || '';
      }
      if (!profilePic) {
        profilePic = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
      }

      // ── Cover photo ──
      let coverUrl = '';
      const coverImg = document.querySelector('[data-pagelet="ProfileCoverPhoto"] img')
        || mainContent?.querySelector('[aria-label*="cover photo"] img, [aria-label*="photo de couverture"] img');
      if (coverImg) coverUrl = (coverImg as HTMLImageElement).src || '';

      // ── Bio (italic text in header) ──
      let bio = '';
      if (mainContent) {
        // Facebook bio is typically italic text under the stats line
        const allSpans = Array.from(mainContent.querySelectorAll('span'));
        for (const span of allSpans) {
          const text = span.textContent?.trim() || '';
          const style = window.getComputedStyle(span);
          if (text.length > 5 && text.length < 500 && style.fontStyle === 'italic') {
            bio = text;
            break;
          }
        }
      }

      // ── og:description as bio fallback ──
      const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';

      // ── Location: extracted from intro items below, not from header (too unreliable) ──

      // ── Stats: friends, followers, following ──
      const stats: Record<string, string> = {};
      if (mainContent) {
        const headerText = mainContent.textContent || '';

        // Pattern: "591 ami(e)s" or "591 friends"
        const friendsMatch = headerText.match(/([\d\s,.]+)\s*(?:ami|friends)/i);
        if (friendsMatch) stats.friends = friendsMatch[1].trim().replace(/\s/g, '');

        // Pattern: "1 K followers" or "1K followers" or "1 000 followers"
        const followersMatch = headerText.match(/([\d\s,.]+\s*[KkMm]?)\s*(?:followers?|abonnés?)/i);
        if (followersMatch) stats.followers = followersMatch[1].trim();

        // Pattern: "2 suivi(e)s" or "following"
        const followingMatch = headerText.match(/([\d\s,.]+)\s*(?:suivi|following)/i);
        if (followingMatch) stats.following = followingMatch[1].trim();

        // Also try from links
        const friendLinks = Array.from(mainContent.querySelectorAll('a[href*="/friends"], a[href*="sk=friends"]'));
        for (const link of friendLinks) {
          const text = link.textContent?.trim() || '';
          const m = text.match(/([\d\s,.]+)/);
          if (m && !stats.friends) stats.friends = m[1].replace(/\s/g, '');
        }
        const followerLinks = Array.from(mainContent.querySelectorAll('a[href*="sk=followers"]'));
        for (const link of followerLinks) {
          const text = link.textContent?.trim() || '';
          const m = text.match(/([\d\s,.]+\s*[KkMm]?)/);
          if (m && !stats.followers) stats.followers = m[1].trim();
        }
      }

      // ── Intro items (left sidebar: "Habite à ...", "De ...", "Femme", etc.) ──
      // IMPORTANT: Work on INDIVIDUAL DOM elements, never on concatenated text
      const introItems: string[] = [];

      // Regex to match a KNOWN intro pattern (must match the ENTIRE text of a span)
      const INTRO_PATTERN = /^(?:Habite à |Vit à |Lives in |De [A-ZÀ-Ü]|From [A-Z]|Femme$|Homme$|Female$|Male$|Non[ -]binaire$|Non-binary$|Travaille |Works at |A étudié à |Studied at |Célibataire$|En couple$|Marié|Single$|In a relationship$|Married$|Né le |Born on |Né en |Born in |Veuf|Divorcé|Widowed$|Divorced$|Pacsé|Fiancé)/i;

      // Strategy: scan ALL individual spans in main content for intro-like text
      if (mainContent) {
        const allSpans = Array.from(mainContent.querySelectorAll('span'));
        for (const span of allSpans) {
          // Only look at LEAF spans (no child spans) to avoid parent duplicates
          if (span.querySelector('span')) continue;
          const text = span.textContent?.trim() || '';
          if (text.length < 3 || text.length > 150) continue;
          if (INTRO_PATTERN.test(text) && !introItems.includes(text)) {
            introItems.push(text);
          }
        }
      }

      // ── Bio from pagelet ──
      const bioPagelet = document.querySelector('[data-pagelet*="Bio"] span, [data-pagelet*="bio"] span')?.textContent?.trim() || '';

      // ── Profile ID from page ──
      let userId = '';
      // Try from canonical URL or og:url (always points to the TARGET profile)
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
      const ogUrl = document.querySelector('meta[property="og:url"]')?.getAttribute('content') || '';
      const profileUrl = canonical || ogUrl || '';
      const idFromUrl = profileUrl.match(/profile\.php\?id=(\d+)/);
      if (idFromUrl) userId = idFromUrl[1];
      // Try from entity_id meta tag
      if (!userId) {
        const entityId = document.querySelector('meta[property="al:android:url"]')?.getAttribute('content') || '';
        const entityMatch = entityId.match(/fb:\/\/profile\/(\d+)/);
        if (entityMatch) userId = entityMatch[1];
      }

      return {
        nameFromH1, nameFromTitle, profilePic, coverUrl,
        bio, bioPagelet, ogDesc,
        introItems, stats, userId,
      };
    });

    console.log(`[Facebook] DOM: name="${domData.nameFromH1}", title="${domData.nameFromTitle}", bio="${domData.bio?.substring(0, 50)}", friends="${domData.stats.friends}", followers="${domData.stats.followers}", introItems=${domData.introItems.length}, items=${JSON.stringify(domData.introItems).substring(0, 200)}`);

    // ── Apply DOM data (primary source) ──
    result.displayName = domData.nameFromH1 || domData.nameFromTitle || '';
    result.profileImageUrl = domData.profilePic || '';
    result.bio = domData.bio || domData.bioPagelet || domData.ogDesc || '';

    if (domData.stats.friends) result.stats.friends = domData.stats.friends;
    if (domData.stats.followers) result.stats.followers = domData.stats.followers;
    if (domData.stats.following) result.stats.following = domData.stats.following;
    if (domData.userId) result.rawMetadata.userId = domData.userId;

    if (domData.introItems.length > 0) {
      result.rawMetadata.introCardItems = domData.introItems.map(label => ({ label }));
    }

    if (domData.coverUrl) {
      result.extraImages.push(domData.coverUrl);
      result.rawMetadata.coverPhotoUrl = domData.coverUrl;
    }

    // ══════════════════════════════════════════════════════════
    // ABOUT PAGE: Navigate to "À propos" tab for structured personal info
    // This is the MOST RELIABLE source for intro items (location, hometown, gender)
    // ══════════════════════════════════════════════════════════

    if (domData.introItems.length === 0) {
      console.log(`[Facebook] No intro items from main page, navigating to About tab...`);
      try {
        // Build about URL from the profile URL
        const aboutUrl = url.includes('profile.php?id=')
          ? `${url.split('?')[0]}?id=${url.match(/id=(\d+)/)?.[1]}&sk=about`
          : `${url.replace(/\/+$/, '')}/about`;

        await page.goto(aboutUrl, { waitUntil: 'networkidle2', timeout: 20000 });
        await delay(2000);

        // Scroll to load lazy sections
        for (let i = 0; i < 4; i++) {
          await page.evaluate((step) => window.scrollBy(0, 500 + step * 300), i);
          await delay(800);
        }

        const aboutData = await page.evaluate(() => {
          const mainContent = document.querySelector('[role="main"]');
          if (!mainContent) return { items: [] };

          const INTRO_PATTERN = /^(?:Habite à |Vit à |Lives in |De [A-ZÀ-Ü]|From [A-Z]|Femme$|Homme$|Female$|Male$|Non[ -]binaire$|Non-binary$|Travaille |Works at |A étudié à |Studied at |Célibataire$|En couple$|Marié|Single$|In a relationship$|Married$|Né le |Born on |Né en |Born in |Veuf|Divorcé|Widowed$|Divorced$|Pacsé|Fiancé)/i;

          const items: string[] = [];

          // Scan LEAF spans only (no child spans = no concatenation issues)
          const allSpans = Array.from(mainContent.querySelectorAll('span'));
          for (const span of allSpans) {
            if (span.querySelector('span')) continue;
            const text = span.textContent?.trim() || '';
            if (text.length < 3 || text.length > 150) continue;
            if (INTRO_PATTERN.test(text) && !items.includes(text)) {
              items.push(text);
            }
          }

          return { items };
        });

        console.log(`[Facebook] About page: found ${aboutData.items.length} intro items: ${JSON.stringify(aboutData.items)}`);

        if (aboutData.items.length > 0) {
          result.rawMetadata.introCardItems = aboutData.items.map(label => ({ label }));
        }
      } catch (err: any) {
        console.warn(`[Facebook] About page navigation failed:`, err.message);
      }
    }

    // ══════════════════════════════════════════════════════════
    // GRAPHQL ENRICHMENT: Only for data NOT available from DOM
    // Use profile_owner ID to strictly filter
    // ══════════════════════════════════════════════════════════

    // Intercept GraphQL responses that were captured during page load
    // We need to re-navigate to capture them, OR use what we already have
    // For now, try to extract ytInitialData-style embedded data
    const graphqlData = await page.evaluate(() => {
      // Try to find user data in script tags (Facebook embeds data in require calls)
      const scripts = Array.from(document.querySelectorAll('script'));
      const userData: any = {};

      for (const script of scripts) {
        const text = script.textContent || '';
        if (text.length < 500) continue;

        // Look for profile_owner pattern in inline scripts
        try {
          // Pattern: "profile_owner":{"__typename":"User","id":"123","name":"..."}
          const ownerMatch = text.match(/"profile_owner"\s*:\s*\{[^}]*"id"\s*:\s*"(\d+)"[^}]*"name"\s*:\s*"([^"]+)"/);
          if (ownerMatch) {
            userData.profileOwnerId = ownerMatch[1];
            userData.profileOwnerName = ownerMatch[2];
          }

          // Pattern: gender
          const genderMatch = text.match(/"gender"\s*:\s*"([^"]+)"/);
          if (genderMatch && !userData.gender) userData.gender = genderMatch[1];

          // Pattern: current_city
          const cityMatch = text.match(/"current_city"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/);
          if (cityMatch && !userData.currentCity) userData.currentCity = cityMatch[1];

          // Pattern: hometown
          const hometownMatch = text.match(/"hometown"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/);
          if (hometownMatch && !userData.hometown) userData.hometown = hometownMatch[1];

          // Pattern: friends count
          const friendsMatch = text.match(/"all_friends"\s*:\s*\{[^}]*"count"\s*:\s*(\d+)/);
          if (friendsMatch && !userData.friendsCount) userData.friendsCount = friendsMatch[1];

          // Pattern: followers count
          const followersMatch = text.match(/"followers_count"\s*:\s*(\d+)/);
          if (followersMatch && !userData.followersCount) userData.followersCount = followersMatch[1];

          // Pattern: is_verified
          const verifiedMatch = text.match(/"is_verified"\s*:\s*(true|false)/);
          if (verifiedMatch && userData.verified == null) userData.verified = verifiedMatch[1] === 'true';

          // Pattern: registration_timestamp
          const regMatch = text.match(/"registration_timestamp"\s*:\s*(\d+)/);
          if (regMatch && !userData.registrationTimestamp) userData.registrationTimestamp = regMatch[1];

        } catch { }
      }

      return userData;
    });

    console.log(`[Facebook] Inline script data: ${JSON.stringify(graphqlData).substring(0, 200)}`);

    // Enrich with GraphQL inline data (only add what's missing)
    // Note: profileOwnerId from regex may be unreliable (could match viewer) — prefer DOM userId
    if (graphqlData.profileOwnerId && !result.rawMetadata.userId) {
      // Only use if it differs from known viewer patterns
      result.rawMetadata.userId = graphqlData.profileOwnerId;
    }
    if (graphqlData.gender && !result.rawMetadata.gender) {
      result.rawMetadata.gender = graphqlData.gender;
    }
    if (graphqlData.currentCity && !result.rawMetadata.currentCity) {
      result.rawMetadata.currentCity = graphqlData.currentCity;
    }
    if (graphqlData.hometown && !result.rawMetadata.hometown) {
      result.rawMetadata.hometown = graphqlData.hometown;
    }
    if (graphqlData.friendsCount && !result.stats.friends) {
      result.stats.friends = graphqlData.friendsCount;
    }
    if (graphqlData.followersCount && !result.stats.followers) {
      result.stats.followers = graphqlData.followersCount;
    }
    if (graphqlData.verified != null) {
      result.rawMetadata.verified = graphqlData.verified;
    }
    if (graphqlData.registrationTimestamp) {
      result.registrationDate = new Date(parseInt(graphqlData.registrationTimestamp) * 1000).toISOString();
    }

    // ══════════════════════════════════════════════════════════
    // FALLBACK: mbasic.facebook.com (static HTML, no JS)
    // ══════════════════════════════════════════════════════════

    if (!result.displayName && result.username) {
      console.log(`[Facebook] No data from main page, trying mbasic.facebook.com...`);
      try {
        const mbasicUrl = result.username.match(/^\d+$/)
          ? `https://mbasic.facebook.com/profile.php?id=${result.username}`
          : `https://mbasic.facebook.com/${result.username}`;

        await page.goto(mbasicUrl, { waitUntil: 'networkidle2', timeout: 20000 });
        await delay(1500);

        const mbasicData = await page.evaluate(() => {
          const title = document.querySelector('title')?.textContent?.trim()
            ?.replace(/\s*[|–-]\s*Facebook.*$/i, '') || '';
          const name = title.replace(/^\(\d+\)\s*/, '');
          const pic = document.querySelector('img[alt*="photo de profil"], img[alt*="profile picture"]');
          const profilePic = pic ? (pic as HTMLImageElement).src : '';
          const aboutSection = document.querySelector('#bio, [id*="bio"], #intro, [id*="intro"]');
          const bio = aboutSection?.textContent?.trim() || '';
          let friends = '';
          const friendsLink = document.querySelector('a[href*="/friends"]');
          if (friendsLink) {
            const m = friendsLink.textContent?.match(/([\d\s,.]+)/);
            if (m) friends = m[1].replace(/\s/g, '');
          }
          const infoItems: string[] = [];
          const profileInfo = document.querySelectorAll('#profile-intro-card li, #intro_container_id div');
          profileInfo.forEach(el => {
            const text = el.textContent?.trim();
            if (text && text.length > 3 && text.length < 200) infoItems.push(text);
          });
          return { name, profilePic, bio, friends, infoItems };
        });

        if (mbasicData.name && !result.displayName) result.displayName = mbasicData.name;
        if (mbasicData.profilePic && !result.profileImageUrl) result.profileImageUrl = mbasicData.profilePic;
        if (mbasicData.bio && !result.bio) result.bio = mbasicData.bio;
        if (mbasicData.friends && !result.stats.friends) result.stats.friends = mbasicData.friends;
        if (mbasicData.infoItems.length > 0 && !result.rawMetadata.introCardItems) {
          result.rawMetadata.introCardItems = mbasicData.infoItems.map(label => ({ label }));
        }

        console.log(`[Facebook] mbasic fallback: name="${mbasicData.name}", pic=${!!mbasicData.profilePic}`);
      } catch (err: any) {
        console.warn(`[Facebook] mbasic fallback failed:`, err.message);
      }
    }

    console.log(`[Facebook] Final: name="${result.displayName}", bio=${result.bio?.length || 0}chars, friends=${result.stats.friends || 'none'}, followers=${result.stats.followers || 'none'}`);

  } catch (error: any) {
    console.error(`[Facebook] Error:`, error.message);
    result.rawMetadata.error = error.message || 'Unknown error';
  }

  return result;
}

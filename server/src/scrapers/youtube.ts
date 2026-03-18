/// <reference lib="dom" />
import { Page } from 'puppeteer-core';
import { ProfileData } from './types';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

function debugLog(msg: string) {
  console.log(`[YouTube] ${msg}`);
}
const randomDelay = () => delay(1000 + Math.random() * 2000);

export async function scrape(page: Page, url: string): Promise<ProfileData> {
  const result: ProfileData = {
    platform: 'youtube',
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
    // Extract channel identifier from URL
    const handleMatch = url.match(/youtube\.com\/@([^/?#]+)/i);
    const channelMatch = url.match(/youtube\.com\/channel\/([^/?#]+)/i);
    const customMatch = url.match(/youtube\.com\/c\/([^/?#]+)/i);
    const userMatch = url.match(/youtube\.com\/user\/([^/?#]+)/i);

    if (handleMatch) result.username = `@${handleMatch[1]}`;
    else if (channelMatch) result.username = channelMatch[1];
    else if (customMatch) result.username = customMatch[1];
    else if (userMatch) result.username = userMatch[1];

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    // ── Set YouTube consent cookie BEFORE navigating (bypass GDPR consent page) ──
    await page.setCookie(
      { name: 'CONSENT', value: 'PENDING+987', domain: '.youtube.com', path: '/' },
      { name: 'SOCS', value: 'CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjMwODI5LjA3X3AxGgJmciACGgYIgJnsBhgB', domain: '.youtube.com', path: '/' },
    );

    // Navigate to channel page
    let channelUrl = url.replace(/\/about\/?$/, '').replace(/\/featured\/?$/, '').replace(/\/?$/, '');
    debugLog(`Navigating to: ${channelUrl}`);
    await page.goto(channelUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await randomDelay();

    // ── Check if we hit a consent page and try to accept it ──
    const currentUrl = page.url();
    debugLog(`Current URL after nav: ${currentUrl}`);

    if (currentUrl.includes('consent.youtube') || currentUrl.includes('consent.google')) {
      debugLog(`Hit consent page, trying to accept...`);
      try {
        // Click "Accept all" / "Tout accepter" button
        const acceptBtn = await page.$('button[aria-label*="Accept"], button[aria-label*="Accepter"], form[action*="consent"] button');
        if (acceptBtn) {
          await acceptBtn.click();
          await delay(3000);
          // Navigate again after consent
          await page.goto(channelUrl, { waitUntil: 'networkidle2', timeout: 30000 });
          await delay(2000);
          debugLog(`Re-navigated after consent`);
        }
      } catch (e: any) {
        debugLog(`Consent handling failed: ${e.message}`);
      }
    }

    // Wait for page to fully render
    await delay(2000);

    // ── Debug: capture page title and check what we got ──
    const pageDebug = await page.evaluate(() => {
      const title = document.title || '';
      const url = window.location.href;
      const hasYtInit = !!(window as any).ytInitialData;
      const scriptCount = document.querySelectorAll('script').length;
      const bodyLen = document.body?.innerHTML?.length || 0;
      // Check for consent/GDPR indicators
      const hasConsentForm = !!document.querySelector('form[action*="consent"]');
      const hasConsentDialog = !!document.querySelector('[aria-label*="consent"], [aria-label*="Consent"]');
      // og tags
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
      const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
      const ogUrl = document.querySelector('meta[property="og:url"]')?.getAttribute('content') || '';
      // link canonical
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
      // itemprop
      const itemName = document.querySelector('[itemprop="name"]')?.getAttribute('content') || '';

      return { title, url, hasYtInit, scriptCount, bodyLen, hasConsentForm, hasConsentDialog,
               ogTitle, ogDesc, ogImage, ogUrl, canonical, itemName };
    });

    debugLog(`Page title: "${pageDebug.title}"`);
    debugLog(`URL: ${pageDebug.url}`);
    debugLog(`ytInitialData in window: ${pageDebug.hasYtInit}`);
    debugLog(`Scripts: ${pageDebug.scriptCount}, Body size: ${pageDebug.bodyLen}`);
    debugLog(`Consent form: ${pageDebug.hasConsentForm}, Consent dialog: ${pageDebug.hasConsentDialog}`);
    debugLog(`OG title: "${pageDebug.ogTitle}", OG desc: "${pageDebug.ogDesc?.substring(0, 100)}"`);
    debugLog(`OG image: "${pageDebug.ogImage?.substring(0, 100)}"`);
    debugLog(`Canonical: "${pageDebug.canonical}", itemprop name: "${pageDebug.itemName}"`);

    // ── Extract ytInitialData ──
    const ytData = await page.evaluate(() => {
      try {
        // Method 1: Direct window variable (most reliable)
        if ((window as any).ytInitialData) {
          return (window as any).ytInitialData;
        }

        // Method 2: Search ALL script tags for ytInitialData assignment
        const scripts = Array.from(document.querySelectorAll('script'));
        for (const script of scripts) {
          const text = script.textContent || '';
          if (!text.includes('ytInitialData')) continue;

          // Pattern: var ytInitialData = {...};
          const varMatch = text.match(/var\s+ytInitialData\s*=\s*(\{.+\})\s*;/s);
          if (varMatch) {
            try { return JSON.parse(varMatch[1]); } catch { }
          }

          // Pattern: window["ytInitialData"] = {...};
          const winMatch = text.match(/window\["ytInitialData"\]\s*=\s*(\{.+\})\s*;/s);
          if (winMatch) {
            try { return JSON.parse(winMatch[1]); } catch { }
          }

          // Pattern: ytInitialData = {...}; (without var)
          const rawMatch = text.match(/ytInitialData\s*=\s*(\{.+\})\s*;/s);
          if (rawMatch) {
            try { return JSON.parse(rawMatch[1]); } catch { }
          }
        }
        return null;
      } catch {
        return null;
      }
    });

    debugLog(`ytInitialData captured: ${!!ytData}`);

    if (ytData) {
      // ── Extract from header ──
      const header = ytData.header;
      debugLog(`Header keys: ${header ? Object.keys(header).join(', ') : 'none'}`);

      // Pattern 1: c4TabbedHeaderRenderer (older channels)
      const c4Header = header?.c4TabbedHeaderRenderer;
      if (c4Header) {
        debugLog(`Using c4TabbedHeaderRenderer`);
        result.displayName = c4Header.title || '';
        result.username = c4Header.channelHandleText?.runs?.[0]?.text || result.username;

        const avatarThumbs = c4Header.avatar?.thumbnails;
        if (avatarThumbs?.length > 0) {
          const sorted = [...avatarThumbs].sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
          result.profileImageUrl = sorted[0].url || '';
        }

        const bannerThumbs = c4Header.banner?.thumbnails;
        if (bannerThumbs?.length > 0) {
          const sorted = [...bannerThumbs].sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
          result.extraImages.push(sorted[0].url);
          result.rawMetadata.bannerUrl = sorted[0].url;
        }

        const subText = c4Header.subscriberCountText?.simpleText
          || c4Header.subscriberCountText?.runs?.map((r: any) => r.text).join('');
        if (subText) result.stats.subscribers = subText;
      }

      // Pattern 2: pageHeaderRenderer (newer channels)
      const pageHeader = header?.pageHeaderRenderer;
      if (pageHeader) {
        debugLog(`Using pageHeaderRenderer`);
        const pageHeaderVM = pageHeader.content?.pageHeaderViewModel;

        if (pageHeaderVM) {
          const title = pageHeaderVM.title?.dynamicTextViewModel?.text?.content
            || pageHeaderVM.title?.content;
          if (title) result.displayName = title;

          const metadata = pageHeaderVM.metadata?.contentMetadataViewModel?.metadataRows;
          if (metadata && Array.isArray(metadata)) {
            for (const row of metadata) {
              const parts = row.metadataParts;
              if (parts && Array.isArray(parts)) {
                for (const part of parts) {
                  const text = part.text?.content || '';
                  if (text.startsWith('@')) result.username = text;
                  if (text.match(/abonn|subscri/i)) result.stats.subscribers = text;
                  if (text.match(/vid[eé]o/i)) result.stats.videos = text;
                }
              }
            }
          }

          const avatarSources = pageHeaderVM.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources;
          if (avatarSources?.length > 0) {
            const sorted = [...avatarSources].sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
            result.profileImageUrl = sorted[0].url || '';
          }

          const bannerSources = pageHeaderVM.banner?.imageBannerViewModel?.image?.sources;
          if (bannerSources?.length > 0) {
            const sorted = [...bannerSources].sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
            result.extraImages.push(sorted[0].url);
            result.rawMetadata.bannerUrl = sorted[0].url;
          }

          const desc = pageHeaderVM.description?.descriptionPreviewViewModel?.description?.content;
          if (desc) result.bio = desc;
        }
      }

      // ── Extract from channelMetadataRenderer ──
      const metadata = ytData.metadata?.channelMetadataRenderer;
      if (metadata) {
        debugLog(`channelMetadataRenderer found`);
        if (!result.displayName) result.displayName = metadata.title || '';
        if (!result.bio) result.bio = metadata.description || '';
        if (!result.profileImageUrl && metadata.avatar?.thumbnails?.[0]) {
          result.profileImageUrl = metadata.avatar.thumbnails[0].url;
        }
        result.rawMetadata.keywords = metadata.keywords || '';
        result.rawMetadata.channelUrl = metadata.channelUrl || metadata.vanityChannelUrl || '';
        if (metadata.ownerUrls && Array.isArray(metadata.ownerUrls)) {
          result.rawMetadata.externalLinks = metadata.ownerUrls;
        }
      }

      // ── Extract from microformat ──
      const microformat = ytData.microformat?.microformatDataRenderer;
      if (microformat) {
        debugLog(`microformatDataRenderer found`);
        if (!result.displayName) result.displayName = microformat.title || '';
        if (!result.bio) result.bio = microformat.description || '';
        if (!result.profileImageUrl && microformat.thumbnail?.thumbnails?.[0]) {
          result.profileImageUrl = microformat.thumbnail.thumbnails[0].url;
        }
        if (microformat.urlCanonical) result.rawMetadata.canonicalUrl = microformat.urlCanonical;
        if (microformat.familySafe != null) result.rawMetadata.familySafe = microformat.familySafe;
        if (microformat.tags) result.rawMetadata.tags = microformat.tags;
      }

      // ── Look for about section data ──
      const tabs = ytData.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
      for (const tab of tabs) {
        const aboutContent = tab.tabRenderer?.content?.sectionListRenderer?.contents;
        if (aboutContent) {
          for (const section of aboutContent) {
            const items = section.itemSectionRenderer?.contents || [];
            for (const item of items) {
              const aboutRenderer = item.channelAboutFullMetadataRenderer;
              if (aboutRenderer) {
                debugLog(`channelAboutFullMetadataRenderer found`);
                if (!result.bio && aboutRenderer.description?.simpleText) result.bio = aboutRenderer.description.simpleText;
                if (aboutRenderer.joinedDateText?.runs) result.registrationDate = aboutRenderer.joinedDateText.runs.map((r: any) => r.text).join('');
                if (aboutRenderer.viewCountText?.simpleText) result.stats.totalViews = aboutRenderer.viewCountText.simpleText;
                if (aboutRenderer.country?.simpleText) result.rawMetadata.country = aboutRenderer.country.simpleText;
                if (aboutRenderer.primaryLinks) {
                  result.rawMetadata.primaryLinks = aboutRenderer.primaryLinks.map((l: any) => ({
                    title: l.title?.simpleText || l.title?.runs?.map((r: any) => r.text).join('') || '',
                    url: l.navigationEndpoint?.urlEndpoint?.url || '',
                  })).filter((l: any) => l.url);
                }
              }
            }
          }
        }

        const aboutTab = tab.tabRenderer;
        if (aboutTab?.tabIdentifier === 'about' || aboutTab?.title === 'About' || aboutTab?.title === 'À propos') {
          const aboutSection = aboutTab?.content?.sectionListRenderer?.contents;
          if (aboutSection) {
            for (const s of aboutSection) {
              const aboutVM = s.itemSectionRenderer?.contents?.[0]?.aboutChannelRenderer?.metadata?.aboutChannelViewModel;
              if (aboutVM) {
                debugLog(`aboutChannelViewModel found`);
                if (!result.bio && aboutVM.description) result.bio = aboutVM.description;
                if (aboutVM.joinedDateText?.content) result.registrationDate = aboutVM.joinedDateText.content;
                if (aboutVM.viewCountText) result.stats.totalViews = aboutVM.viewCountText;
                if (aboutVM.country) result.rawMetadata.country = aboutVM.country;
                if (aboutVM.canonicalChannelUrl) result.rawMetadata.channelUrl = aboutVM.canonicalChannelUrl;
                if (aboutVM.links && Array.isArray(aboutVM.links)) {
                  result.rawMetadata.primaryLinks = aboutVM.links.map((l: any) => ({
                    title: l.channelExternalLinkViewModel?.title?.content || '',
                    url: l.channelExternalLinkViewModel?.link?.content || '',
                  })).filter((l: any) => l.url);
                }
              }
            }
          }
        }
      }
    }

    // ── Even if ytInitialData failed, try meta tags (always available, even on consent pages) ──
    if (!result.displayName || !result.profileImageUrl) {
      debugLog(`Falling back to meta tags`);
      const metaData = await page.evaluate(() => {
        const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
        const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
        const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
        const ogUrl = document.querySelector('meta[property="og:url"]')?.getAttribute('content') || '';
        const itemName = document.querySelector('[itemprop="name"]')?.getAttribute('content') || '';
        const itemDesc = document.querySelector('[itemprop="description"]')?.getAttribute('content') || '';
        const itemImage = document.querySelector('[itemprop="thumbnailUrl"]')?.getAttribute('href')
          || document.querySelector('link[itemprop="thumbnailUrl"]')?.getAttribute('href') || '';
        const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
        const channelName = document.querySelector('#channel-name yt-formatted-string')?.textContent?.trim() || '';
        const subCount = document.querySelector('#subscriber-count')?.textContent?.trim() || '';
        const avatarImg = document.querySelector('#avatar img')?.getAttribute('src')
          || document.querySelector('#channel-header img')?.getAttribute('src') || '';

        // JSON-LD
        const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        let jsonLdData: any = null;
        for (const s of jsonLdScripts) {
          try {
            const parsed = JSON.parse(s.textContent || '');
            if (parsed.name) { jsonLdData = parsed; break; }
          } catch { }
        }

        return { ogTitle, ogDesc, ogImage, ogUrl, itemName, itemDesc, itemImage, canonical,
                 channelName, subCount, avatarImg, jsonLdData };
      });

      debugLog(`Meta fallback: ogTitle="${metaData.ogTitle}", channelName="${metaData.channelName}", ogImage=${!!metaData.ogImage}`);

      // Display name
      if (!result.displayName) {
        result.displayName = metaData.channelName
          || metaData.itemName
          || metaData.jsonLdData?.name
          || (metaData.ogTitle ? metaData.ogTitle.replace(/\s*-\s*YouTube.*$/i, '').trim() : '')
          || '';
      }

      // Profile image
      if (!result.profileImageUrl) {
        result.profileImageUrl = metaData.avatarImg || metaData.ogImage || metaData.itemImage || '';
      }

      // Bio
      if (!result.bio) {
        result.bio = metaData.itemDesc || metaData.ogDesc || metaData.jsonLdData?.description || '';
      }

      // Subscribers
      if (!result.stats.subscribers && metaData.subCount) {
        result.stats.subscribers = metaData.subCount;
      }

      // Channel URL
      if (!result.rawMetadata.channelUrl) {
        result.rawMetadata.channelUrl = metaData.canonical || metaData.ogUrl || '';
      }

      // JSON-LD extras
      if (metaData.jsonLdData) {
        if (metaData.jsonLdData.image && !result.profileImageUrl) {
          result.profileImageUrl = typeof metaData.jsonLdData.image === 'string'
            ? metaData.jsonLdData.image : metaData.jsonLdData.image.url || '';
        }
      }
    }

    // ── Try navigating to /about tab if we're missing join date / views ──
    if (!result.registrationDate || !result.stats.totalViews) {
      try {
        const aboutUrl = channelUrl + '/about';
        debugLog(`Navigating to about page: ${aboutUrl}`);
        await page.goto(aboutUrl, { waitUntil: 'networkidle2', timeout: 20000 });
        await delay(2000);

        const aboutData = await page.evaluate(() => {
          if ((window as any).ytInitialData) {
            const yt = (window as any).ytInitialData;
            const tabs = yt.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
            for (const tab of tabs) {
              const contents = tab.tabRenderer?.content?.sectionListRenderer?.contents;
              if (!contents) continue;
              for (const section of contents) {
                const items = section.itemSectionRenderer?.contents || [];
                for (const item of items) {
                  const about = item.channelAboutFullMetadataRenderer;
                  if (about) {
                    return {
                      joinDate: about.joinedDateText?.runs?.map((r: any) => r.text).join('') || about.joinedDateText?.simpleText || '',
                      views: about.viewCountText?.simpleText || '',
                      country: about.country?.simpleText || '',
                      description: about.description?.simpleText || '',
                    };
                  }
                  const aboutVM = item.aboutChannelRenderer?.metadata?.aboutChannelViewModel;
                  if (aboutVM) {
                    return {
                      joinDate: aboutVM.joinedDateText?.content || '',
                      views: aboutVM.viewCountText || '',
                      country: aboutVM.country || '',
                      description: aboutVM.description || '',
                    };
                  }
                }
              }
            }
          }
          return null;
        });

        if (aboutData) {
          debugLog(`About page data: joinDate=${aboutData.joinDate}, views=${aboutData.views}`);
          if (!result.registrationDate && aboutData.joinDate) result.registrationDate = aboutData.joinDate;
          if (!result.stats.totalViews && aboutData.views) result.stats.totalViews = aboutData.views;
          if (!result.rawMetadata.country && aboutData.country) result.rawMetadata.country = aboutData.country;
          if (!result.bio && aboutData.description) result.bio = aboutData.description;
        }
      } catch (err: any) {
        debugLog(`About page navigation failed: ${err.message}`);
      }
    }

    debugLog(`Final: name="${result.displayName}", username="${result.username}", bio=${result.bio?.length || 0}chars, pic=${!!result.profileImageUrl}, subs=${result.stats.subscribers || 'none'}`);

  } catch (error: any) {
    debugLog(`ERROR: Scraper error: ${error.message}`);
    result.rawMetadata.error = error.message || 'Unknown error';
  }

  return result;
}

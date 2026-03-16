/// <reference lib="dom" />
import { Page } from 'puppeteer';
import { ProfileData } from './types';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const randomDelay = () => delay(1000 + Math.random() * 2000);

export async function scrape(page: Page, url: string): Promise<ProfileData> {
  const result: ProfileData = {
    platform: 'linkedin',
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
    const usernameMatch = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
    const companyMatch = url.match(/linkedin\.com\/company\/([^/?#]+)/i);
    if (usernameMatch) result.username = usernameMatch[1];
    else if (companyMatch) { result.username = companyMatch[1]; result.rawMetadata.isCompany = true; }

    // Intercept Voyager API responses
    const voyagerData: any[] = [];
    const responseHandler = async (response: any) => {
      try {
        const rUrl = response.url();
        if (rUrl.includes('/voyager/api/') || rUrl.includes('linkedin.com/li/')) {
          const json = await response.json().catch(() => null);
          if (json) voyagerData.push({ url: rUrl, data: json });
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

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await randomDelay();
    // Wait for profile content to render
    await page.waitForSelector('h1', { timeout: 15000 }).catch(() => {});
    await delay(3000);

    // Scroll to trigger more data loading
    await page.evaluate(() => window.scrollBy(0, 800));
    await delay(2000);

    // ── "À propos de ce profil" modal — member since + verifications ──
    try {
      // Click the "À propos de ce profil" / "About this profile" link
      const openedModal = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a, button, span'));
        for (const el of links) {
          const text = el.textContent?.trim().toLowerCase() || '';
          if (text.includes('à propos de ce profil') || text.includes('about this profile')) {
            (el as HTMLElement).click();
            return true;
          }
        }
        return false;
      });

      if (openedModal) {
        await delay(2000);

        const aboutProfile = await page.evaluate(() => {
          // Find the modal content
          const modal = document.querySelector('[role="dialog"], [class*="modal"], [class*="artdeco-modal"]');
          if (!modal) return null;

          const text = modal.textContent || '';
          const data: any = {};

          // Member since: "novembre 2014", "November 2014", etc.
          const memberMatch = text.match(/(?:Membre depuis|Member since)\s*\n?\s*([a-zéûàè]+ \d{4})/i);
          if (memberMatch) data.memberSince = memberMatch[1].trim();

          // Verifications
          const verifications: string[] = [];
          const verifiedMatch = text.match(/Vérifié par\s+([^.]+?)(?:\s*Il y a|\s*\n)/i)
            || text.match(/Verified (?:by|with)\s+([^.]+?)(?:\s*ago|\s*\n)/i);
          if (verifiedMatch) verifications.push(verifiedMatch[1].trim());

          // Identity verification
          if (text.includes('government ID') || text.includes('pièce d\'identité')) {
            data.identityVerified = true;
          }

          if (verifications.length > 0) data.verifications = verifications;

          return Object.keys(data).length > 0 ? data : null;
        });

        if (aboutProfile) {
          if (aboutProfile.memberSince) {
            result.rawMetadata.memberSince = aboutProfile.memberSince;
          }
          if (aboutProfile.identityVerified) {
            result.rawMetadata.identityVerified = true;
          }
          if (aboutProfile.verifications) {
            result.rawMetadata.verifications = aboutProfile.verifications;
          }
          console.log(`[LinkedIn] About profile: ${JSON.stringify(aboutProfile)}`);
        }

        // Close the modal
        await page.evaluate(() => {
          const closeBtn = document.querySelector('[role="dialog"] button[aria-label*="Fermer"], [role="dialog"] button[aria-label*="Close"], [role="dialog"] button[aria-label*="Dismiss"]');
          if (closeBtn) (closeBtn as HTMLElement).click();
        });
        await delay(500);
      }
    } catch (err) {
      console.log(`[LinkedIn] About profile modal failed: ${(err as any).message}`);
    }

    // ── Parse Voyager API responses ──
    const targetUsername = result.username.toLowerCase();
    for (const entry of voyagerData) {
      try {
        const data = entry.data;
        const elements = data.included || data.elements || [];

        // Search in included elements (LinkedIn's response format)
        for (const el of elements) {
          if (!el) continue;

          // Profile data (miniProfile or full profile)
          // IMPORTANT: only accept the target profile, not suggested profiles
          if (el.firstName && el.lastName) {
            const elIdentifier = (el.publicIdentifier || '').toLowerCase();
            const isTarget = !targetUsername || elIdentifier === targetUsername
              || el.entityUrn?.includes(targetUsername);
            if (!isTarget) continue;

            result.displayName = `${el.firstName} ${el.lastName}`.trim();
            if (el.headline) result.bio = el.headline;
            if (el.summary) result.rawMetadata.summary = el.summary;
            if (el.locationName) result.rawMetadata.location = el.locationName;
            if (el.industryName) result.rawMetadata.industry = el.industryName;
            if (el.publicIdentifier) result.username = el.publicIdentifier;
            if (el.geoLocationName) result.rawMetadata.location = el.geoLocationName;

            // Extract ALL vectorImage URLs, then classify by URL content
            const imageSourcesRaw: Array<{ rootUrl: string; artifacts: any[]; source: string }> = [];
            // profilePicture
            const ppVec = el.profilePicture?.displayImageReference?.vectorImage;
            if (ppVec?.rootUrl && ppVec?.artifacts?.length > 0) imageSourcesRaw.push({ ...ppVec, source: 'profilePicture' });
            // picture (miniProfile)
            const picVec = el.picture?.['com.linkedin.common.VectorImage'];
            if (picVec?.rootUrl && picVec?.artifacts?.length > 0) imageSourcesRaw.push({ ...picVec, source: 'picture' });
            if (el.picture?.rootUrl && el.picture?.artifacts) imageSourcesRaw.push({ rootUrl: el.picture.rootUrl, artifacts: el.picture.artifacts, source: 'miniPicture' });
            // backgroundImage
            const bgVec = el.backgroundImage?.['com.linkedin.common.VectorImage'];
            if (bgVec?.rootUrl && bgVec?.artifacts?.length > 0) imageSourcesRaw.push({ ...bgVec, source: 'backgroundImage' });

            for (const imgSrc of imageSourcesRaw) {
              const largest = imgSrc.artifacts.reduce((a: any, b: any) =>
                (a.width || 0) > (b.width || 0) ? a : b
              );
              const fullUrl = imgSrc.rootUrl + largest.fileIdentifyingUrlPathSegment;
              // Classify: background images go to cover, others to profile pic
              const isBackground = fullUrl.includes('background') || fullUrl.includes('banner')
                || fullUrl.includes('displaybackgroundimage')
                || imgSrc.source === 'backgroundImage';
              if (isBackground) {
                if (!result.rawMetadata.coverPhotoUrl) {
                  result.extraImages.push(fullUrl);
                  result.rawMetadata.coverPhotoUrl = fullUrl;
                }
              } else {
                // Profile photo — prefer displayphoto URLs
                if (!result.profileImageUrl || fullUrl.includes('displayphoto')) {
                  result.profileImageUrl = fullUrl;
                }
              }
              console.log(`[LinkedIn] Image: source=${imgSrc.source}, isBackground=${isBackground}, url=${fullUrl.substring(0, 120)}`);
            }
          }

          // Network info (connections count)
          if (el.followersCount != null) result.stats.followers = el.followersCount;
          if (el.connectionsCount != null) result.stats.connections = el.connectionsCount;
          if (el.connectionCount != null) result.stats.connections = el.connectionCount;
          if (el.numConnections != null) result.stats.connections = el.numConnections;

          // Experience
          if (el['$type']?.includes('Position') || (el.title && el.companyName)) {
            if (!result.rawMetadata.experience) result.rawMetadata.experience = [];
            result.rawMetadata.experience.push({
              title: el.title || '',
              company: el.companyName || el.company?.name || '',
              location: el.locationName || '',
              start: el.timePeriod?.startDate ? `${el.timePeriod.startDate.month || ''}/${el.timePeriod.startDate.year}` : '',
              end: el.timePeriod?.endDate ? `${el.timePeriod.endDate.month || ''}/${el.timePeriod.endDate.year}` : 'Présent',
              description: el.description || '',
            });
          }

          // Education
          if (el['$type']?.includes('Education') || (el.schoolName && el.degreeName !== undefined)) {
            if (!result.rawMetadata.education) result.rawMetadata.education = [];
            result.rawMetadata.education.push({
              school: el.schoolName || el.school?.name || '',
              degree: el.degreeName || '',
              field: el.fieldOfStudy || '',
            });
          }

          // Skills
          if (el['$type']?.includes('Skill') && el.name) {
            if (!result.rawMetadata.skills) result.rawMetadata.skills = [];
            result.rawMetadata.skills.push(el.name);
          }
        }

        // Look for network size in the response data itself
        if (data.data?.networkSize?.count != null) {
          result.stats.connections = data.data.networkSize.count;
        }
      } catch { }
    }

    // ── Strategy 2: Try Voyager API directly if authenticated ──
    if (!result.displayName && result.username) {
      try {
        const csrfToken = await page.evaluate(() => {
          const meta = document.querySelector('meta[name="csrf-token"]');
          if (meta) return meta.getAttribute('content');
          // Fallback: get from cookies
          const cookies = document.cookie.split(';');
          for (const c of cookies) {
            const [name, value] = c.trim().split('=');
            if (name === 'JSESSIONID') return value?.replace(/"/g, '');
          }
          return '';
        });

        if (csrfToken) {
          const apiData = await page.evaluate(async (username: string, token: string) => {
            try {
              const resp = await fetch(`/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${username}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.WebTopCardCore-18`, {
                headers: {
                  'csrf-token': token,
                  'x-restli-protocol-version': '2.0.0',
                },
                credentials: 'include',
              });
              if (resp.ok) return await resp.json();
            } catch { }
            return null;
          }, result.username, csrfToken);

          if (apiData) {
            result.rawMetadata.voyagerProfile = apiData;
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
      if (ld['@type'] === 'Person') {
        if (!result.displayName && ld.name) result.displayName = ld.name;
        if (!result.bio && ld.description) result.bio = ld.description;
        if (ld.image && !result.profileImageUrl) {
          result.profileImageUrl = typeof ld.image === 'string' ? ld.image : ld.image?.contentUrl || ld.image?.url || '';
        }
        if (ld.jobTitle) result.rawMetadata.jobTitle = ld.jobTitle;
        if (ld.worksFor) result.rawMetadata.company = typeof ld.worksFor === 'string' ? ld.worksFor : ld.worksFor?.name;
        if (ld.address) result.rawMetadata.location = typeof ld.address === 'string' ? ld.address : ld.address?.addressLocality;
        if (ld.alumniOf) {
          result.rawMetadata.education = Array.isArray(ld.alumniOf)
            ? ld.alumniOf.map((a: any) => typeof a === 'string' ? a : { school: a.name || '' }).filter(Boolean)
            : [typeof ld.alumniOf === 'string' ? ld.alumniOf : { school: ld.alumniOf?.name || '' }].filter(Boolean);
        }
        if (ld.sameAs) result.rawMetadata.sameAs = ld.sameAs;
        if (ld.interactionStatistic) {
          for (const stat of ld.interactionStatistic) {
            if ((stat.name === 'Follows' || stat.interactionType?.includes('Follow')) && !result.stats.followers) {
              result.stats.followers = stat.userInteractionCount || 0;
            }
          }
        }
      }
    }

    // ── DOM fallbacks ──
    if (!result.displayName) {
      result.displayName = await page.evaluate(() => {
        return document.querySelector('h1.text-heading-xlarge, .pv-top-card h1, [class*="top-card"] h1, h1')?.textContent?.trim() || '';
      });
    }

    if (!result.bio) {
      result.bio = await page.evaluate(() => {
        return document.querySelector('.text-body-medium.break-words, [class*="top-card"] .headline, [class*="headline"]')?.textContent?.trim() || '';
      });
    }

    // ALWAYS try DOM for profile picture — Voyager API often gives the background image instead
    // Scroll back to top to ensure profile photo is visible
    await page.evaluate(() => window.scrollTo(0, 0));
    await delay(1000);

    const domProfilePic = await page.evaluate(() => {
      // Strategy 1: img with class containing "pv-top-card-profile-picture"
      const img1 = document.querySelector('img[class*="pv-top-card-profile-picture"]');
      if (img1 && (img1 as HTMLImageElement).src) return (img1 as HTMLImageElement).src;

      // Strategy 2: img with class containing "profile-photo" or "ember-view" inside profile header
      const img2 = document.querySelector('.pv-top-card .profile-photo-edit img, .pv-top-card img.ember-view');
      if (img2 && (img2 as HTMLImageElement).src) return (img2 as HTMLImageElement).src;

      // Strategy 3: img inside .pv-top-card--photo or presence-entity
      const img3 = document.querySelector('.pv-top-card--photo img, .presence-entity__image, img[class*="presence-entity"]');
      if (img3 && (img3 as HTMLImageElement).src) return (img3 as HTMLImageElement).src;

      // Strategy 4: img with title/alt matching h1 (the user's name)
      const h1 = document.querySelector('h1')?.textContent?.trim();
      if (h1) {
        // Try exact match first, then partial match
        const allImgs = Array.from(document.querySelectorAll('img'));
        for (const img of allImgs) {
          const title = img.getAttribute('title') || '';
          const alt = img.getAttribute('alt') || '';
          if ((title === h1 || alt === h1) && img.src && !img.src.includes('background') && img.offsetWidth > 30) {
            return img.src;
          }
        }
        // Partial name match (first name)
        const firstName = h1.split(' ')[0];
        if (firstName && firstName.length > 1) {
          for (const img of allImgs) {
            const alt = img.getAttribute('alt') || '';
            if (alt.includes(firstName) && img.src && !img.src.includes('background') && img.offsetWidth > 30) {
              return img.src;
            }
          }
        }
      }

      // Strategy 5: any img with "displayphoto" in src (LinkedIn profile photo URL pattern)
      const allImgs = Array.from(document.querySelectorAll('img'));
      for (const img of allImgs) {
        if (img.src?.includes('displayphoto') && img.offsetWidth > 30) return img.src;
      }

      // Strategy 6: any img with "profile" in src hosted on media.licdn.com, excluding background
      for (const img of allImgs) {
        if (img.src?.includes('media.licdn.com') && img.src?.includes('profile')
          && !img.src.includes('background') && !img.src.includes('banner')
          && img.offsetWidth >= 50 && img.offsetHeight >= 50) {
          return img.src;
        }
      }

      // Strategy 7: img inside the top-card area with reasonable size (likely profile photo)
      const topCard = document.querySelector('.pv-top-card, [class*="top-card"], [class*="profile-card"]');
      if (topCard) {
        const cardImgs = Array.from(topCard.querySelectorAll('img'));
        for (const img of cardImgs) {
          if (img.src && img.offsetWidth >= 50 && img.offsetHeight >= 50
            && !img.src.includes('background') && !img.src.includes('banner')
            && !img.src.includes('logo') && !img.src.includes('company')) {
            return img.src;
          }
        }
      }

      return '';
    });
    console.log(`[LinkedIn] DOM profile pic: ${domProfilePic?.substring(0, 120) || 'none'}`);

    // Also extract cover/banner image from DOM
    const domCoverPic = await page.evaluate(() => {
      // Strategy 1: img with "background" or "banner" in class/src within top-card
      const bgImg = document.querySelector('.profile-background-image img, [class*="cover-img"] img, img[class*="banner"]');
      if (bgImg && (bgImg as HTMLImageElement).src) return (bgImg as HTMLImageElement).src;
      // Strategy 2: any img with "background" in src on media.licdn.com
      const allImgs = Array.from(document.querySelectorAll('img'));
      for (const img of allImgs) {
        if (img.src?.includes('media.licdn.com')
          && (img.src.includes('background') || img.src.includes('banner'))
          && img.offsetWidth > 100) {
          return img.src;
        }
      }
      return '';
    });
    if (domCoverPic && !result.rawMetadata.coverPhotoUrl) {
      result.extraImages.push(domCoverPic);
      result.rawMetadata.coverPhotoUrl = domCoverPic;
      console.log(`[LinkedIn] DOM cover pic: ${domCoverPic.substring(0, 120)}`);
    }

    // Classify current profileImageUrl — move cover/background to extraImages
    if (result.profileImageUrl) {
      const isBackground = result.profileImageUrl.includes('background')
        || result.profileImageUrl.includes('banner')
        || result.profileImageUrl.includes('displaybackgroundimage');
      if (isBackground) {
        if (!result.rawMetadata.coverPhotoUrl) {
          result.extraImages.push(result.profileImageUrl);
          result.rawMetadata.coverPhotoUrl = result.profileImageUrl;
        }
        result.profileImageUrl = ''; // Clear it so DOM or fallback can take over
      }
    }

    if (domProfilePic) {
      // If we had a non-background profileImageUrl from API but DOM found a better one,
      // keep the API one as extra if it's different
      if (result.profileImageUrl && result.profileImageUrl !== domProfilePic
        && !result.extraImages.includes(result.profileImageUrl)) {
        // API image was not background but different from DOM — probably a lower-res version, skip
      }
      result.profileImageUrl = domProfilePic;
    } else if (!result.profileImageUrl) {
      result.profileImageUrl = await page.evaluate(() => {
        return document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
      });
    }

    if (!result.rawMetadata.location) {
      result.rawMetadata.location = await page.evaluate(() => {
        return document.querySelector('.text-body-small.inline.t-black--light.break-words, [class*="top-card"] [class*="location"]')?.textContent?.trim() || '';
      });
    }

    if (!result.stats.connections) {
      const conn = await page.evaluate(() => {
        const el = document.querySelector('[class*="connections"] span, a[href*="connections"]');
        const text = el?.textContent?.trim() || '';
        const num = text.match(/([\d,.+]+)/);
        return num ? num[1] : '';
      });
      if (conn) result.stats.connections = conn;
    }

    // Summary / About section — click "voir plus" first to expand
    if (!result.rawMetadata.summary) {
      // Try to expand the about section
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        for (const btn of buttons) {
          const text = btn.textContent?.trim().toLowerCase() || '';
          if ((text.includes('voir plus') || text.includes('see more')) && btn.closest('#about, [id*="about"]')) {
            (btn as HTMLElement).click();
            break;
          }
        }
      });
      await delay(500);

      result.rawMetadata.summary = await page.evaluate(() => {
        // Strategy 1: section#about + next sibling div with text
        const aboutSection = document.getElementById('about');
        if (aboutSection) {
          // The content is in a sibling div after the #about anchor
          let sibling = aboutSection.parentElement?.nextElementSibling || aboutSection.nextElementSibling;
          while (sibling) {
            const text = sibling.querySelector('.inline-show-more-text, [class*="show-more"], span[aria-hidden="true"]')?.textContent?.trim();
            if (text && text.length > 20) return text;
            // Fallback: any span with substantial text in the section
            const spans = Array.from(sibling.querySelectorAll('span'));
            for (const span of spans) {
              const t = span.textContent?.trim() || '';
              if (t.length > 50 && !t.includes('voir plus') && !t.includes('see more')) return t;
            }
            sibling = sibling.nextElementSibling;
            if (sibling?.tagName === 'SECTION' || sibling?.id) break;
          }
        }
        // Strategy 2: broad selector
        return document.querySelector('[class*="about"] .inline-show-more-text, #about ~ div .inline-show-more-text')?.textContent?.trim() || '';
      });
    }

    // Services section — LinkedIn lists services with bullet separators (·)
    const services = await page.evaluate(() => {
      // Find the section containing "Services" heading
      const sections = Array.from(document.querySelectorAll('section'));
      for (const section of sections) {
        const heading = section.querySelector('h2, h3');
        const headingText = heading?.textContent?.trim().toLowerCase() || '';
        if (!headingText.includes('service')) continue;
        // Find the text with bullet separators (·)
        const allText = section.textContent || '';
        // Extract just the service list — look for spans containing the bullet-separated list
        const spans = Array.from(section.querySelectorAll('span'));
        for (const span of spans) {
          const t = span.textContent?.trim() || '';
          // Service lists contain · separators and are reasonably long
          if (t.includes('·') && t.length > 10 && !t.includes('Demander') && !t.includes('Voir tous')) {
            return t;
          }
        }
        // Fallback: get individual service items from the section
        const items = Array.from(section.querySelectorAll('li, [class*="service"]'));
        const serviceList: string[] = [];
        for (const item of items) {
          const t = item.textContent?.trim() || '';
          if (t.length > 3 && t.length < 80 && !t.includes('Demander') && !t.includes('Voir tous')) {
            if (!serviceList.includes(t)) serviceList.push(t);
          }
        }
        if (serviceList.length > 0) return serviceList.join(' · ');
      }
      return '';
    });
    if (services) result.rawMetadata.services = services;

    // Meta description
    const metaDesc = await page.evaluate(() => {
      return document.querySelector('meta[property="og:description"]')?.getAttribute('content')
        || document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    });
    if (metaDesc) {
      result.rawMetadata.metaDescription = metaDesc;
      if (!result.stats.followers) {
        const m = metaDesc.match(/([\d,.KkMm]+)\s*(?:followers?|abonnés)/i);
        if (m) result.stats.followers = m[1];
      }
    }

    page.off('response', responseHandler);
  } catch (error: any) {
    result.rawMetadata.error = error.message || 'Unknown error';
  }

  return result;
}

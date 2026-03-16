/// <reference lib="dom" />
import { Page } from 'puppeteer';
import { ProfileData } from './types';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const randomDelay = () => delay(1000 + Math.random() * 2000);

/**
 * WhatsApp scraper - passive check only.
 * Checks if a phone number has WhatsApp WITHOUT sending any message.
 * NEVER opens WhatsApp Web or initiates any interaction.
 */
export async function scrape(page: Page, url: string): Promise<ProfileData> {
  const result: ProfileData = {
    platform: 'whatsapp',
    username: '',
    displayName: '',
    bio: '',
    profileImageUrl: '',
    stats: {},
    registrationDate: null,
    extraImages: [],
    rawMetadata: {
      exists: false,
      phoneNumber: '',
      checkMethod: 'wa.me',
    },
  };

  try {
    // Extract phone number from URL or direct input
    let phoneNumber = '';

    const waMatch = url.match(/wa\.me\/(\+?\d+)/i);
    const apiMatch = url.match(/api\.whatsapp\.com\/send\?phone=(\+?\d+)/i);
    const directMatch = url.match(/^(\+?\d{7,15})$/);

    if (waMatch) {
      phoneNumber = waMatch[1];
    } else if (apiMatch) {
      phoneNumber = apiMatch[1];
    } else if (directMatch) {
      phoneNumber = directMatch[1];
    } else {
      const anyNumber = url.match(/(\d{7,15})/);
      if (anyNumber) phoneNumber = anyNumber[1];
    }

    if (!phoneNumber) {
      result.rawMetadata.error = 'Could not extract phone number from URL';
      return result;
    }

    phoneNumber = phoneNumber.replace(/[\s\-()]/g, '');
    const cleanNumber = phoneNumber.replace(/^\+/, '');

    result.username = cleanNumber;
    result.rawMetadata.phoneNumber = cleanNumber;

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    );

    // Navigate to wa.me/{number} to check if account exists
    const waUrl = `https://wa.me/${cleanNumber}`;
    const response = await page.goto(waUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(3000);

    const finalUrl = page.url();
    const statusCode = response?.status() || 0;

    result.rawMetadata.finalUrl = finalUrl;
    result.rawMetadata.statusCode = statusCode;

    // Check page content to determine if account exists
    const pageAnalysis = await page.evaluate(() => {
      const bodyText = document.body?.textContent?.toLowerCase() || '';
      const title = document.title || '';
      const hasChat = bodyText.includes('continue to chat') || bodyText.includes('message')
        || bodyText.includes('partager sur whatsapp') || bodyText.includes('envoyer');
      const hasError = bodyText.includes('phone number shared via url is invalid')
        || bodyText.includes('invalid')
        || bodyText.includes("doesn't have")
        || bodyText.includes('not found')
        || bodyText.includes('numéro de téléphone');
      const hasSendButton = !!document.querySelector('a[href*="web.whatsapp.com"], a[href*="api.whatsapp.com"]');

      // Extract all meta tags for richer data
      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
      const ogDescription = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';

      // Extract profile image from page elements
      const profileImg = document.querySelector('img[src*="pps.whatsapp.net"]') as HTMLImageElement;
      const profileImgSrc = profileImg?.src || '';

      return {
        hasChat,
        hasError,
        hasSendButton,
        title,
        ogImage,
        ogTitle,
        ogDescription,
        profileImgSrc,
        bodyText: bodyText.substring(0, 500),
      };
    });

    result.rawMetadata.pageAnalysis = pageAnalysis;

    // Determine if account exists
    if (pageAnalysis.hasChat || pageAnalysis.hasSendButton) {
      result.rawMetadata.exists = true;
    } else if (pageAnalysis.hasError) {
      result.rawMetadata.exists = false;
    } else if (statusCode === 200 && !pageAnalysis.hasError) {
      result.rawMetadata.exists = true;
    } else if (statusCode === 404 || statusCode >= 400) {
      result.rawMetadata.exists = false;
    }

    // Use og:image as profile picture (WhatsApp serves the profile pic here)
    if (pageAnalysis.ogImage && pageAnalysis.ogImage.includes('pps.whatsapp.net')) {
      result.profileImageUrl = pageAnalysis.ogImage;
      result.rawMetadata.profilePicturePublic = true;
    } else if (pageAnalysis.profileImgSrc) {
      result.profileImageUrl = pageAnalysis.profileImgSrc;
      result.rawMetadata.profilePicturePublic = true;
    }

    // If og:image didn't work, try navigating to pps endpoint directly
    if (!result.profileImageUrl) {
      try {
        const ppsUrl = `https://pps.whatsapp.net/v/t61.24694-24/${cleanNumber}`;
        const ppsResponse = await page.goto(ppsUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 10000,
        });

        if (ppsResponse && ppsResponse.status() === 200) {
          const contentType = ppsResponse.headers()['content-type'] || '';
          if (contentType.includes('image')) {
            result.profileImageUrl = ppsUrl;
            result.rawMetadata.profilePicturePublic = true;
          }
        }
      } catch {
        result.rawMetadata.profilePicturePublic = false;
      }
    }

    // Set display name
    if (result.rawMetadata.exists) {
      result.displayName = `WhatsApp User (+${cleanNumber})`;
      result.stats.status = result.rawMetadata.exists ? 'Compte actif' : 'Non trouvé';
    }

    // Extract any additional info from og tags
    if (pageAnalysis.ogTitle && pageAnalysis.ogTitle !== 'WhatsApp') {
      result.rawMetadata.ogTitle = pageAnalysis.ogTitle;
    }
    if (pageAnalysis.ogDescription) {
      result.rawMetadata.ogDescription = pageAnalysis.ogDescription;
    }

  } catch (error: any) {
    result.rawMetadata.error = error.message || 'Unknown error';
  }

  return result;
}

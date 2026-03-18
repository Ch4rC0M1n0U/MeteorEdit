/// <reference lib="dom" />
import { Page } from 'puppeteer-core';
import { ProfileData } from './types';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Try to enrich profile data using GramJS (Telegram MTProto API).
 * Requires api_id, api_hash, and a saved session string.
 */
async function enrichWithGramJS(
  username: string,
  result: ProfileData,
  telegramConfig: { apiId: number; apiHash: string; session: string }
): Promise<void> {
  try {
    const { TelegramClient } = await import('telegram');
    const { StringSession } = await import('telegram/sessions');
    const { Api } = await import('telegram');

    const client = new TelegramClient(
      new StringSession(telegramConfig.session),
      telegramConfig.apiId,
      telegramConfig.apiHash,
      { connectionRetries: 3 }
    );

    await client.connect();

    if (!client.connected) {
      console.log('[Telegram] GramJS: not connected (session may be invalid)');
      return;
    }

    // Resolve username to get full user data
    const entity = await client.getEntity(username);

    if (!entity) {
      console.log('[Telegram] GramJS: entity not found');
      await client.disconnect();
      return;
    }

    const entityData = entity as any;
    console.log(`[Telegram] GramJS: found entity type=${entityData.className}, id=${entityData.id}`);

    // Basic user/channel info
    if (entityData.firstName) result.displayName = `${entityData.firstName} ${entityData.lastName || ''}`.trim();
    if (entityData.title) result.displayName = entityData.title; // For channels
    if (entityData.username) result.username = entityData.username;
    if (entityData.id) result.rawMetadata.telegramId = entityData.id.toString();

    // Flags
    if (entityData.verified) result.rawMetadata.verified = true;
    if (entityData.premium) result.rawMetadata.premium = true;
    if (entityData.bot) result.rawMetadata.isBot = true;
    if (entityData.scam) result.rawMetadata.scam = true;
    if (entityData.fake) result.rawMetadata.fake = true;
    if (entityData.restricted) result.rawMetadata.restricted = true;

    // Status (last seen)
    if (entityData.status) {
      const status = entityData.status;
      if (status.className === 'UserStatusOnline') {
        result.rawMetadata.lastSeen = 'En ligne';
      } else if (status.className === 'UserStatusOffline' && status.wasOnline) {
        result.rawMetadata.lastSeen = new Date(status.wasOnline * 1000).toISOString();
      } else if (status.className === 'UserStatusRecently') {
        result.rawMetadata.lastSeen = 'Récemment';
      } else if (status.className === 'UserStatusLastWeek') {
        result.rawMetadata.lastSeen = 'Cette semaine';
      } else if (status.className === 'UserStatusLastMonth') {
        result.rawMetadata.lastSeen = 'Ce mois-ci';
      }
    }

    // Get full user info (bio, common chats, etc.)
    try {
      if (entityData.className === 'User') {
        const fullUser = await client.invoke(
          new Api.users.GetFullUser({
            id: new Api.InputUser({
              userId: entityData.id,
              accessHash: entityData.accessHash,
            }),
          })
        );

        const full = (fullUser as any).fullUser;
        if (full) {
          if (full.about) result.bio = full.about;
          if (full.commonChatsCount) result.rawMetadata.commonChats = full.commonChatsCount;
          if (full.birthday) result.rawMetadata.birthday = full.birthday;
        }
      } else if (entityData.className === 'Channel' || entityData.className === 'Chat') {
        // Channel/group info
        const fullChat = await client.invoke(
          new Api.channels.GetFullChannel({
            channel: new Api.InputChannel({
              channelId: entityData.id,
              accessHash: entityData.accessHash,
            }),
          })
        );

        const full = (fullChat as any).fullChat;
        if (full) {
          if (full.about) result.bio = full.about;
          if (full.participantsCount) result.stats.members = full.participantsCount;
          if (full.linkedChatId) result.rawMetadata.linkedChat = full.linkedChatId.toString();
        }

        // Channel stats
        if (entityData.participantsCount) result.stats.members = entityData.participantsCount;
      }
    } catch (err: any) {
      console.log(`[Telegram] GramJS: getFullUser failed: ${err.message}`);
    }

    // Download profile photo
    try {
      const photoBuffer = await client.downloadProfilePhoto(username) as Buffer;
      if (photoBuffer && photoBuffer.length > 100) {
        const fs = await import('fs');
        const path = await import('path');
        const { v4: uuidv4 } = await import('uuid');

        const UPLOAD_DIR = path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || './uploads');
        const PROFILES_DIR = path.join(UPLOAD_DIR, 'profiles');
        if (!fs.existsSync(PROFILES_DIR)) {
          fs.mkdirSync(PROFILES_DIR, { recursive: true });
        }

        const filename = `telegram-${username}-${uuidv4().slice(0, 8)}.jpg`;
        const filePath = path.join(PROFILES_DIR, filename);
        fs.writeFileSync(filePath, photoBuffer);
        result.rawMetadata.localProfilePhoto = `uploads/profiles/${filename}`;
        console.log(`[Telegram] GramJS: profile photo saved: ${filename} (${photoBuffer.length} bytes)`);
      }
    } catch (err: any) {
      console.log(`[Telegram] GramJS: photo download failed: ${err.message}`);
    }

    await client.disconnect();
    result.rawMetadata.enrichedVia = 'gramjs';
    console.log(`[Telegram] GramJS enrichment complete: name="${result.displayName}", bio=${result.bio?.length || 0}chars`);

  } catch (err: any) {
    console.error(`[Telegram] GramJS error: ${err.message}`);
  }
}

export async function scrape(page: Page, url: string, telegramConfig?: { apiId: number; apiHash: string; session: string }): Promise<ProfileData> {
  const result: ProfileData = {
    platform: 'telegram',
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
    const usernameMatch = url.match(/(?:t\.me|telegram\.me)\/([^/?#]+)/i)
      || url.match(/@([A-Za-z0-9_]+)/);
    if (usernameMatch) {
      result.username = usernameMatch[1];
    }

    if (!result.username) {
      result.rawMetadata.error = 'Could not extract Telegram username from URL';
      return result;
    }

    // ── Strategy 1: GramJS (if configured) ──
    if (telegramConfig && telegramConfig.apiId && telegramConfig.apiHash && telegramConfig.session) {
      console.log(`[Telegram] GramJS config available, enriching ${result.username}...`);
      await enrichWithGramJS(result.username, result, telegramConfig);
    }

    // ── Strategy 2: Scrape t.me page (always, for basic data + fallback) ──
    const tmeUrl = `https://t.me/${result.username}`;

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    await page.goto(tmeUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(3000);

    const domData = await page.evaluate(() => {
      // Profile picture — t.me uses <img> in .tgme_page_photo_image
      let profilePic = '';
      const photoImg = document.querySelector('.tgme_page_photo_image img, img[class*="tgme_page_photo"]');
      if (photoImg) profilePic = (photoImg as HTMLImageElement).src || '';

      // Display name
      let displayName = '';
      const nameEl = document.querySelector('.tgme_page_title span, .tgme_page_title');
      if (nameEl) displayName = nameEl.textContent?.trim() || '';

      // Bio / description
      let bio = '';
      const bioEl = document.querySelector('.tgme_page_description');
      if (bioEl) bio = bioEl.textContent?.trim() || '';

      // Extra info
      let extra = '';
      const extraEl = document.querySelector('.tgme_page_extra');
      if (extraEl) extra = extraEl.textContent?.trim() || '';

      // Members count (for channels/groups)
      let members = '';
      const membersEl = document.querySelector('.tgme_page_extra');
      if (membersEl) {
        const text = membersEl.textContent || '';
        const m = text.match(/([\d\s,.]+)\s*(?:members?|subscribers?|abonnés?|membres?)/i);
        if (m) members = m[1].replace(/\s/g, '').trim();
      }

      // Type detection
      let accountType = '';
      const bodyText = document.body.textContent?.toLowerCase() || '';
      if (bodyText.includes('send message') || bodyText.includes('envoyer un message')) accountType = 'user';
      else if (bodyText.includes('preview channel') || bodyText.includes('view channel')) accountType = 'channel';
      else if (bodyText.includes('view group') || bodyText.includes('join group')) accountType = 'group';
      else if (bodyText.includes('open bot') || bodyText.includes('start bot')) accountType = 'bot';

      // Verified badge
      const verified = !!document.querySelector('.verified-icon, [class*="verified"], .tgme_page_verified');

      // Check if page exists (404)
      const notFound = bodyText.includes('this user doesn') || bodyText.includes('preview the channel')
        || document.title.includes('Telegram') && !displayName;

      // og:image as fallback
      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';

      return { displayName, bio, profilePic, extra, members, accountType, verified, notFound, ogImage };
    });

    console.log(`[Telegram] DOM: name="${domData.displayName}", bio=${domData.bio?.length || 0}chars, pic=${!!domData.profilePic}, type=${domData.accountType}`);

    // Apply DOM data (fill gaps not covered by GramJS)
    if (!result.displayName && domData.displayName) result.displayName = domData.displayName;
    if (!result.bio && domData.bio) result.bio = domData.bio;
    if (!result.profileImageUrl) {
      result.profileImageUrl = domData.profilePic || domData.ogImage || '';
    }

    if (domData.verified) result.rawMetadata.verified = true;
    if (domData.accountType) result.rawMetadata.accountType = domData.accountType;
    if (domData.members) result.stats.members = domData.members;
    if (domData.extra) result.rawMetadata.extra = domData.extra;

    // If GramJS saved a local photo, use it (higher quality)
    if (result.rawMetadata.localProfilePhoto) {
      result.rawMetadata.originalProfileImageUrl = result.profileImageUrl;
      // Will be resolved to full URL by the controller
    }

    result.rawMetadata.tmeUrl = tmeUrl;

  } catch (error: any) {
    console.error(`[Telegram] Error:`, error.message);
    result.rawMetadata.error = error.message || 'Unknown error';
  }

  return result;
}

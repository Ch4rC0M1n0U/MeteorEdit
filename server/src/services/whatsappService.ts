import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import pkg from 'whatsapp-web.js';
import { toWhatsappId } from './phoneScannerHelpers';
import SocialCookie from '../models/SocialCookie';

const { Client, LocalAuth } = pkg;
type WAClient = InstanceType<typeof Client>;

export interface WAProfile {
  name?: string;
  about?: string;
  avatarUrl?: string;
  isBusiness?: boolean;
}

export interface WASessionInfo {
  phone?: string;
  name?: string;
  pairedAt?: Date;
}

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 min
const WA_AUTH_PATH = process.env.WA_AUTH_PATH || path.resolve(__dirname, '..', '..', '.wwebjs_auth');
const CHROMIUM_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROMIUM_PATH || '/usr/bin/chromium';

type ClientState = {
  client: WAClient;
  ready: boolean;
  lastUsedAt: number;
  emitter: EventEmitter;
  sessionInfo: WASessionInfo | null;
};

class WhatsappService {
  private clients = new Map<string, ClientState>();
  private idleSweeper: NodeJS.Timeout | null = null;

  constructor() {
    this.ensureAuthDir();
    this.startIdleSweeper();
  }

  /**
   * Initialize a NEW pairing session for the given user. Returns an EventEmitter
   * that fires 'qr' (with QR string), 'ready', 'auth_failure', 'disconnected'.
   */
  pairNewSession(userId: string): EventEmitter {
    const existing = this.clients.get(userId);
    if (existing) {
      // Destroy old client before re-pairing
      existing.client.destroy().catch(() => {});
      this.clients.delete(userId);
    }

    // Clean any stale Chrome locks for this user's profile before launching
    this.cleanStaleLocks(this.authPathFor(userId));

    const emitter = new EventEmitter();
    const client = this.buildClient(userId);
    const state: ClientState = {
      client,
      ready: false,
      lastUsedAt: Date.now(),
      emitter,
      sessionInfo: null,
    };
    this.clients.set(userId, state);

    client.on('qr', (qr: string) => {
      emitter.emit('qr', qr);
    });

    client.on('ready', async () => {
      state.ready = true;
      state.lastUsedAt = Date.now();
      try {
        const info = client.info;
        const phone = info?.wid?.user;
        const name = info?.pushname;
        state.sessionInfo = { phone, name, pairedAt: new Date() };

        // Persist to DB
        await SocialCookie.findOneAndUpdate(
          { userId, platform: 'whatsapp' },
          {
            $set: {
              sessionMode: 'wa-web',
              cookies: '',
              whatsappWebSession: {
                isActive: true,
                pairedAt: new Date(),
                authPath: this.authPathFor(userId),
                accountInfo: { phone, name },
                lastUsedAt: new Date(),
              },
            },
          },
          { upsert: true, new: true }
        );

        emitter.emit('ready', state.sessionInfo);
      } catch (err) {
        console.error('[whatsappService] ready handler error:', err);
        emitter.emit('error', err);
      }
    });

    client.on('auth_failure', (msg: string) => {
      emitter.emit('auth_failure', msg);
      this.destroySession(userId).catch(() => {});
    });

    client.on('disconnected', (reason: string) => {
      emitter.emit('disconnected', reason);
      this.destroySession(userId).catch(() => {});
    });

    // Catch any uncaught errors from the client (Puppeteer crashes etc.) so they
    // don't propagate as unhandledRejection / uncaughtException and crash the server.
    client.on('error' as any, (err: unknown) => {
      console.error('[whatsappService] client error:', err);
      emitter.emit('error', err);
    });

    client.initialize().catch((err: unknown) => {
      console.error('[whatsappService] initialize error:', err);
      emitter.emit('error', err);
      // Schedule cleanup so a retry can re-init cleanly
      this.clients.delete(userId);
      try {
        client.destroy().catch(() => {});
      } catch {
        // ignore
      }
    });

    return emitter;
  }

  isReady(userId: string): boolean {
    const state = this.clients.get(userId);
    return !!(state && state.ready);
  }

  getSessionInfo(userId: string): WASessionInfo | null {
    const state = this.clients.get(userId);
    return state?.sessionInfo ?? null;
  }

  /**
   * Reload a session from disk LocalAuth without re-pairing.
   * Returns true if session was successfully restored, false otherwise.
   */
  async restoreSession(userId: string): Promise<boolean> {
    if (this.clients.has(userId)) {
      return this.isReady(userId);
    }
    const auth = await SocialCookie.findOne({ userId, platform: 'whatsapp' });
    if (!auth?.whatsappWebSession?.isActive) {
      return false;
    }

    return new Promise((resolve) => {
      const emitter = new EventEmitter();
      const client = this.buildClient(userId);
      const state: ClientState = {
        client,
        ready: false,
        lastUsedAt: Date.now(),
        emitter,
        sessionInfo: auth.whatsappWebSession?.accountInfo
          ? {
              phone: auth.whatsappWebSession.accountInfo.phone,
              name: auth.whatsappWebSession.accountInfo.name,
              pairedAt: auth.whatsappWebSession.pairedAt,
            }
          : null,
      };
      this.clients.set(userId, state);

      const onReady = () => {
        state.ready = true;
        state.lastUsedAt = Date.now();
        cleanup();
        resolve(true);
      };
      const onFail = () => {
        cleanup();
        this.destroySession(userId).catch(() => {});
        resolve(false);
      };
      const cleanup = () => {
        client.off('ready', onReady);
        client.off('auth_failure', onFail);
      };

      client.once('ready', onReady);
      client.once('auth_failure', onFail);
      client.initialize().catch(() => {
        cleanup();
        resolve(false);
      });

      // Safety timeout
      setTimeout(() => {
        if (!state.ready) {
          cleanup();
          resolve(false);
        }
      }, 60000);
    });
  }

  /**
   * Check whether a phone number is registered on WhatsApp.
   */
  async checkNumberExists(userId: string, phoneE164: string): Promise<boolean> {
    const state = this.requireReady(userId);
    state.lastUsedAt = Date.now();
    const numberId = await state.client.getNumberId(toWhatsappId(phoneE164));
    return numberId !== null;
  }

  /**
   * Fetch the public profile of a phone number (name, about, avatar).
   * Returns null if number is not registered or fetch fails.
   */
  async getProfile(userId: string, phoneE164: string): Promise<WAProfile | null> {
    const state = this.requireReady(userId);
    state.lastUsedAt = Date.now();

    try {
      const numberId = await state.client.getNumberId(toWhatsappId(phoneE164));
      if (!numberId) return null;

      const contactId = numberId._serialized;
      const profile: WAProfile = {};

      // Detect self-lookup: WA Web's getContactById/getProfilePicUrl return
      // mostly nothing for the account that is currently connected. We must
      // read from client.info instead.
      const selfWid: string | undefined = (state.client as any).info?.wid?._serialized;
      const isSelf = !!selfWid && selfWid === contactId;

      if (isSelf) {
        const info: any = (state.client as any).info;
        profile.name = info?.pushname || undefined;
        try {
          const aboutRes = await (state.client as any).getStatus?.(contactId);
          if (aboutRes?.status) profile.about = aboutRes.status;
        } catch { /* about may be unavailable */ }
        try {
          const avatarUrl = await state.client.getProfilePicUrl(contactId);
          if (avatarUrl) profile.avatarUrl = avatarUrl;
        } catch { /* avatar may be unavailable */ }
        profile.isBusiness = !!info?.platform && info.platform === 'business';
      } else {
        try {
          const contact = await state.client.getContactById(contactId);
          profile.name = contact.pushname || contact.name || contact.shortName || undefined;
          profile.isBusiness = contact.isBusiness ?? false;
          try {
            const about = await contact.getAbout();
            if (about) profile.about = about;
          } catch { /* about may be private */ }
        } catch (err) {
          console.warn('[whatsappService] getContactById failed:', err);
        }
        try {
          const avatarUrl = await state.client.getProfilePicUrl(contactId);
          if (avatarUrl) profile.avatarUrl = avatarUrl;
        } catch { /* avatar may be private */ }
      }

      console.log('[whatsappService.getProfile]', phoneE164, {
        isSelf,
        hasName: !!profile.name,
        hasAvatar: !!profile.avatarUrl,
        hasAbout: !!profile.about,
      });

      await SocialCookie.updateOne(
        { userId, platform: 'whatsapp' },
        { $set: { 'whatsappWebSession.lastUsedAt': new Date() } }
      );

      return profile;
    } catch (err) {
      console.error('[whatsappService] getProfile error:', err);
      return null;
    }
  }

  /**
   * Destroy a user's session — closes client + flushes DB record.
   */
  async destroySession(userId: string): Promise<void> {
    const state = this.clients.get(userId);
    if (state) {
      try {
        await state.client.destroy();
      } catch {
        // ignore
      }
      this.clients.delete(userId);
    }

    await SocialCookie.updateOne(
      { userId, platform: 'whatsapp' },
      {
        $set: {
          sessionMode: 'cookies',
          'whatsappWebSession.isActive': false,
        },
      }
    );

    // Best-effort cleanup of LocalAuth folder
    const dir = this.authPathFor(userId);
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } catch (err) {
      console.warn('[whatsappService] failed to clean LocalAuth dir:', err);
    }
  }

  async shutdown(): Promise<void> {
    if (this.idleSweeper) {
      clearInterval(this.idleSweeper);
      this.idleSweeper = null;
    }
    const ids = Array.from(this.clients.keys());
    await Promise.all(ids.map((id) => this.destroySession(id).catch(() => {})));
  }

  private buildClient(userId: string): WAClient {
    return new Client({
      authStrategy: new LocalAuth({
        clientId: userId,
        dataPath: WA_AUTH_PATH,
      }),
      puppeteer: {
        executablePath: CHROMIUM_PATH,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      },
    });
  }

  private authPathFor(userId: string): string {
    return path.join(WA_AUTH_PATH, `session-${userId}`);
  }

  private ensureAuthDir(): void {
    try {
      if (!fs.existsSync(WA_AUTH_PATH)) {
        fs.mkdirSync(WA_AUTH_PATH, { recursive: true });
      }
      // Clean up stale Chrome SingletonLock files left by previous container instances.
      // Without this, whatsapp-web.js fails to launch with "profile appears to be in use".
      this.cleanStaleLocks(WA_AUTH_PATH);
    } catch (err) {
      console.warn('[whatsappService] could not create auth dir:', err);
    }
  }

  private cleanStaleLocks(dir: string): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          this.cleanStaleLocks(full);
        } else if (
          entry.name === 'SingletonLock' ||
          entry.name === 'SingletonCookie' ||
          entry.name === 'SingletonSocket' ||
          entry.name === 'lockfile'
        ) {
          try {
            fs.unlinkSync(full);
            console.log('[whatsappService] removed stale lock:', full);
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore — not fatal
    }
  }

  private requireReady(userId: string): ClientState {
    const state = this.clients.get(userId);
    if (!state || !state.ready) {
      throw new Error(`WhatsApp session not ready for user ${userId}`);
    }
    return state;
  }

  private startIdleSweeper(): void {
    this.idleSweeper = setInterval(() => {
      const now = Date.now();
      for (const [userId, state] of this.clients.entries()) {
        if (now - state.lastUsedAt > IDLE_TIMEOUT_MS) {
          // Idle: close client but keep DB session record
          state.client.destroy().catch(() => {});
          this.clients.delete(userId);
        }
      }
    }, 60000);
  }
}

export const whatsappService = new WhatsappService();

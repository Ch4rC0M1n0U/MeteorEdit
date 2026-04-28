import { Server as SocketIOServer } from 'socket.io';
import { Types } from 'mongoose';
import PhoneScan, { type IPhoneScan } from '../models/PhoneScan';
import PhoneScanResult from '../models/PhoneScanResult';
import SocialCookie from '../models/SocialCookie';
import { getPhoneScannerSettings } from '../models/PhoneScannerSettings';
import { whatsappService } from './whatsappService';
import {
  expandPattern,
  randomDelayMs,
  todayDateKey,
} from './phoneScannerHelpers';
import { logActivity } from '../utils/activityLogger';

interface JobState {
  scanId: string;
  cancelled: boolean;
}

class PhoneScannerQueue {
  private jobs = new Map<string, JobState>();
  private io: SocketIOServer | null = null;

  setSocketServer(io: SocketIOServer): void {
    this.io = io;
  }

  isRunning(scanId: string): boolean {
    return this.jobs.has(scanId);
  }

  cancel(scanId: string): boolean {
    const job = this.jobs.get(scanId);
    if (!job) return false;
    job.cancelled = true;
    return true;
  }

  /**
   * Enqueue and immediately start processing a scan job.
   * Runs asynchronously; the caller does not need to await completion.
   */
  enqueue(scan: IPhoneScan): void {
    const scanId = String(scan._id);
    if (this.jobs.has(scanId)) {
      return;
    }
    const state: JobState = { scanId, cancelled: false };
    this.jobs.set(scanId, state);

    // Fire and forget — errors are caught inside processJob
    this.processJob(scan, state).finally(() => {
      this.jobs.delete(scanId);
    });
  }

  private async processJob(scan: IPhoneScan, state: JobState): Promise<void> {
    const scanId = String(scan._id);
    const userId = String(scan.userId);
    const dossierId = String(scan.dossierId);

    try {
      const settings = await getPhoneScannerSettings();
      const numbers = expandPattern(scan.pattern, settings.combinationsBlockThreshold);

      // Mark scan as running
      scan.status = 'running';
      scan.startedAt = new Date();
      await scan.save();
      this.emit(scanId, 'progress', { tested: 0, found: 0, errors: 0, status: 'running' });

      // Restore WA session if needed (only if whatsapp is in platforms)
      const needsWA = scan.platforms.includes('whatsapp');
      let waReady = false;
      if (needsWA) {
        waReady = whatsappService.isReady(userId)
          ? true
          : await whatsappService.restoreSession(userId);
      }

      let tested = 0;
      let found = 0;
      let errors = 0;

      for (const phoneE164 of numbers) {
        if (state.cancelled) {
          scan.status = 'cancelled';
          break;
        }

        // Check daily quotas
        const quotaReason = await this.getQuotaExceededReason(userId, settings);
        if (quotaReason) {
          scan.status = 'rate_limited';
          scan.errorMessage = quotaReason;
          break;
        }

        const result = await this.scanSingleNumber(
          phoneE164,
          userId,
          dossierId,
          scanId,
          waReady
        );

        tested++;
        if (result.status === 'exists') found++;
        if (result.status === 'error') errors++;

        // Update progress
        scan.progress = { tested, found, errors };
        await PhoneScan.updateOne({ _id: scan._id }, { $set: { progress: scan.progress } });
        this.emit(scanId, 'progress', {
          tested,
          found,
          errors,
          total: numbers.length,
          lastResult: { phoneE164, status: result.status },
        });

        // Update daily counters (after each test, regardless of result)
        await this.incrementDailyCounters(userId, settings);

        // Random delay before next number (skip on last)
        if (tested < numbers.length && !state.cancelled) {
          const delay = randomDelayMs(settings.minDelayMs, settings.maxDelayMs);
          await this.sleep(delay);
        }
      }

      if (scan.status === 'running') {
        scan.status = 'completed';
      }
      scan.completedAt = new Date();
      await scan.save();

      this.emit(scanId, 'complete', {
        tested,
        found,
        errors,
        total: numbers.length,
        status: scan.status,
        errorMessage: scan.errorMessage,
      });

      await logActivity(
        userId,
        'phone-scanner.scan.complete',
        'system',
        scanId,
        { dossierId, tested, found, errors, status: scan.status }
      );
    } catch (err) {
      console.error('[phoneScannerQueue] job error:', err);
      scan.status = 'failed';
      scan.errorMessage = err instanceof Error ? err.message : String(err);
      scan.completedAt = new Date();
      await scan.save();
      this.emit(scanId, 'error', { message: scan.errorMessage });
    }
  }

  private async scanSingleNumber(
    phoneE164: string,
    userId: string,
    dossierId: string,
    scanId: string,
    waReady: boolean
  ): Promise<{ status: 'exists' | 'not_found' | 'error' | 'rate_limited' }> {
    try {
      // Phase A only: wa.me scraping is unreliable (returns same /send page for any number)
      // Use whatsapp-web.js getNumberId() which queries WA's internal API.
      if (!waReady) {
        await PhoneScanResult.create({
          scanId,
          dossierId,
          userId,
          phoneE164,
          platform: 'whatsapp',
          status: 'error',
          errorMessage: 'No WhatsApp Web session paired. Pair your phone in Profile > Social sessions.',
        });
        return { status: 'error' };
      }

      // Check existence
      const exists = await whatsappService.checkNumberExists(userId, phoneE164);
      if (!exists) {
        await PhoneScanResult.create({
          scanId,
          dossierId,
          userId,
          phoneE164,
          platform: 'whatsapp',
          status: 'not_found',
        });
        return { status: 'not_found' };
      }

      // Fetch profile
      const profile = await whatsappService.getProfile(userId, phoneE164);
      await PhoneScanResult.create({
        scanId,
        dossierId,
        userId,
        phoneE164,
        platform: 'whatsapp',
        status: 'exists',
        ...(profile ? { profile } : {}),
      });
      return { status: 'exists' };
    } catch (err) {
      console.error('[phoneScannerQueue] scanSingleNumber error:', err);
      await PhoneScanResult.create({
        scanId,
        dossierId,
        userId,
        phoneE164,
        platform: 'whatsapp',
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      });
      return { status: 'error' };
    }
  }

  private async getQuotaExceededReason(
    userId: string,
    settings: { maxDailyChecksGlobal: number; maxDailyChecksPerUser: number; globalDailyCounter: { date: string; count: number } }
  ): Promise<string | null> {
    const today = todayDateKey();

    // Global counter
    if (settings.globalDailyCounter.date === today
        && settings.globalDailyCounter.count >= settings.maxDailyChecksGlobal) {
      return `Quota global atteint (${settings.globalDailyCounter.count}/${settings.maxDailyChecksGlobal} numéros/jour)`;
    }

    // User counter
    const record = await SocialCookie.findOne({ userId, platform: 'whatsapp' });
    const userCounter = record?.dailyScanCounter;
    if (userCounter?.date === today && userCounter.count >= settings.maxDailyChecksPerUser) {
      return `Quota personnel atteint (${userCounter.count}/${settings.maxDailyChecksPerUser} numéros/jour). Réinitialisation à minuit.`;
    }

    return null;
  }

  private async incrementDailyCounters(
    userId: string,
    settings: { _id: unknown; globalDailyCounter: { date: string; count: number } }
  ): Promise<void> {
    const today = todayDateKey();
    const settingsId = settings._id as Types.ObjectId;

    // Global counter
    const Settings = (await import('../models/PhoneScannerSettings')).default;
    if (settings.globalDailyCounter.date !== today) {
      await Settings.updateOne(
        { _id: settingsId },
        { $set: { globalDailyCounter: { date: today, count: 1 } } }
      );
      settings.globalDailyCounter.date = today;
      settings.globalDailyCounter.count = 1;
    } else {
      await Settings.updateOne(
        { _id: settingsId },
        { $inc: { 'globalDailyCounter.count': 1 } }
      );
      settings.globalDailyCounter.count++;
    }

    // User counter
    const record = await SocialCookie.findOne({ userId, platform: 'whatsapp' });
    if (!record) return;
    const userCounter = record.dailyScanCounter;
    if (!userCounter || userCounter.date !== today) {
      await SocialCookie.updateOne(
        { _id: record._id },
        { $set: { dailyScanCounter: { date: today, count: 1 } } }
      );
    } else {
      await SocialCookie.updateOne(
        { _id: record._id },
        { $inc: { 'dailyScanCounter.count': 1 } }
      );
    }
  }

  private emit(scanId: string, event: string, payload: unknown): void {
    if (!this.io) return;
    this.io.to(`scan:${scanId}`).emit(`scan:${event}`, payload);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const phoneScannerQueue = new PhoneScannerQueue();

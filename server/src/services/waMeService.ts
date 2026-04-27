import puppeteer from 'puppeteer-core';
import type { Browser, Page } from 'puppeteer-core';
import { toWhatsappId } from './phoneScannerHelpers';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/usr/bin/chromium';

class WaMeService {
  private browser: Browser | null = null;
  private idleTimer: NodeJS.Timeout | null = null;

  async checkWaMe(phoneE164: string): Promise<'exists' | 'not_found' | 'error'> {
    let page: Page | null = null;
    try {
      const browser = await this.ensureBrowser();
      page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      );

      const id = toWhatsappId(phoneE164);
      const url = `https://wa.me/${id}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

      const bodyText = await page.evaluate(() => document.body?.innerText || '');
      const lower = bodyText.toLowerCase();

      if (lower.includes('phone number shared via url is invalid')) {
        return 'not_found';
      }
      if (lower.includes('open chat') || lower.includes('continue to chat')) {
        return 'exists';
      }
      // Default: assume invalid if no recognizable marker
      return 'not_found';
    } catch (err) {
      console.error('[waMeService] checkWaMe error:', err);
      return 'error';
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
      this.scheduleIdleShutdown();
    }
  }

  private async ensureBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) {
      return this.browser;
    }
    this.browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    });
    return this.browser;
  }

  private scheduleIdleShutdown(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.shutdown().catch(() => {});
    }, IDLE_TIMEOUT_MS);
  }

  async shutdown(): Promise<void> {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // ignore
      }
      this.browser = null;
    }
  }
}

export const waMeService = new WaMeService();

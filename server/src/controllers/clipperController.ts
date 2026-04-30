import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { AuthRequest } from '../middleware/auth';
import DossierNode from '../models/DossierNode';
import Dossier from '../models/Dossier';
import { logActivity } from '../utils/activityLogger';
import { computeFileHash } from '../utils/hashFile';
import { getBaseUrl, toAbsoluteUrlFromBase } from '../utils/imageUrl';
import { getBypassRules, getUA, getExtraHeaders } from '../utils/bypassRules';

const UPLOAD_DIR = path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || './uploads');

/**
 * Consent/cookie management platform scripts to block universally.
 * Blocking these prevents consent popups from ever rendering on ANY site.
 */
const CONSENT_SCRIPT_PATTERNS: RegExp[] = [
  // --- DPG Media (7sur7, HLN, De Morgen, Humo, VTM) ---
  /myprivacy-static\.dpgmedia\.net\/consent\.js/i,
  /sp\.dpgmedia\.net\//i,
  /pg\.dpgmedia\.be\/api\/consent/i,
  /pg\.dpgmedia\.net\/api\/metrics/i,
  // --- Sourcepoint ---
  /cdn\.privacy-mgmt\.com/i,
  /sourcepoint\.mgr\.consensu\.org/i,
  // --- OneTrust ---
  /cdn\.cookielaw\.org/i,
  /optanon\.blob\.core\.windows\.net/i,
  /onetrust\.com\/consent/i,
  /geolocation\.onetrust\.com/i,
  // --- Cookiebot ---
  /consent\.cookiebot\.com/i,
  /consentcdn\.cookiebot\.com/i,
  // --- Didomi ---
  /sdk\.privacy-center\.org/i,
  /api\.privacy-center\.org/i,
  /cdn\.didomi\.io/i,
  // --- Quantcast / TCF ---
  /quantcast\.mgr\.consensu\.org/i,
  /cmp\.quantcast\.com/i,
  /apis\.quantcast\.mgr/i,
  // --- TrustArc ---
  /consent\.trustarc\.com/i,
  /consent-pref\.trustarc\.com/i,
  // --- Axeptio ---
  /client\.axept\.io/i,
  /static\.axept\.io/i,
  // --- Iubenda ---
  /cdn\.iubenda\.com\/cs/i,
  // --- Usercentrics ---
  /app\.usercentrics\.eu/i,
  /aggregator\.service\.usercentrics/i,
  // --- CookieFirst ---
  /consent\.cookiefirst\.com/i,
  // --- Osano ---
  /cmp\.osano\.com/i,
  // --- Civic Cookie Control ---
  /cc\.cdn\.civiccomputing\.com/i,
  // --- Cookie Information ---
  /policy\.app\.cookieinformation\.com/i,
  // --- Generic consent/GDPR scripts ---
  /consent-manager/i,
  /cookie-consent\.js/i,
  /gdpr-consent/i,
];

/**
 * Attempts to dismiss cookie/GDPR consent banners by clicking common accept buttons
 * and hiding known cookie banner elements.
 */
async function dismissCookieBanners(page: any): Promise<void> {
  try {
    // Common selectors for "accept all cookies" buttons across various consent frameworks
    const acceptSelectors = [
      // --- DPG Media (7sur7, HLN, De Morgen, Humo) ---
      'button.message-component.message-button.no-children.focusable.sp_choice_type_11',
      'button[title="D\'accord"]',
      'button[title="Akkoord"]',
      'button[title="Agree"]',
      '.sp_choice_type_11', // Sourcepoint CMP accept button
      '#sp-cc-accept',
      // --- Sourcepoint CMP (used by DPG, VRT, etc.) ---
      'button[aria-label="D\'accord"]',
      'button[aria-label="Akkoord"]',
      // --- Social Media specific ---
      // Instagram cookie consent
      '[data-testid="cookie-policy-manage-dialog-accept-button"]',
      // Facebook/Meta cookie consent
      '[data-cookiebanner="accept_button"]',
      '[data-testid="cookie-policy-manage-dialog-accept-button"]',
      'button[data-cookiebanner="accept_only_essential_button"]',
      // Twitter/X cookie consent
      '[data-testid="xMigrationBottomBar"] [role="button"]',
      // LinkedIn
      'button.artdeco-global-alert__action',
      // Reddit
      'button._1tI68pPnLBjR1iHcL7vsee',
      // TikTok
      'button.tiktok-cookie-banner__button--accept',

      // --- Generic text-based ---
      'button[id*="accept"]',
      'button[id*="consent"]',
      'button[id*="cookie"]',
      'button[class*="accept"]',
      'button[class*="consent"]',
      'a[id*="accept"]',
      'a[class*="accept"]',
      // OneTrust (very common)
      '#onetrust-accept-btn-handler',
      '.onetrust-close-btn-handler',
      // Cookiebot
      '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
      '#CybotCookiebotDialogBodyButtonAccept',
      // Quantcast / TCF
      '.qc-cmp2-summary-buttons button[mode="primary"]',
      '.qc-cmp-button',
      // Didomi
      '#didomi-notice-agree-button',
      // Axeptio
      '[data-reach="axeptio"] button',
      // TrustArc
      '.truste-consent-button',
      '.trustarc-agree-btn',
      // Cookie Notice / GDPR plugins
      '.cookie-notice-container .cn-set-cookie',
      '.cc-btn.cc-allow',
      '.cc-accept-all',
      // Generic patterns
      '[data-testid="cookie-policy-dialog-accept-button"]',
      '[data-cookiefirst-action="accept"]',
      '[aria-label*="accept" i]',
      '[aria-label*="accepter" i]',
      '[aria-label*="autoriser" i]',
    ];

    // Try clicking accept buttons by selector
    for (const selector of acceptSelectors) {
      try {
        const btn = await page.$(selector);
        if (btn) {
          const isVisible = await page.evaluate(`
            (() => {
              const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
              if (!el) return false;
              const s = getComputedStyle(el);
              return el.offsetParent !== null && s.display !== 'none' && s.visibility !== 'hidden';
            })()
          `);
          if (isVisible) {
            await btn.click();
            await new Promise(r => setTimeout(r, 300));
            return;
          }
        }
      } catch {
        // Selector didn't match or click failed, try next
      }
    }

    // Fallback: find buttons by text content (French & English)
    const clickByTextScript = `(() => {
      const keywords = [
        "d'accord", 'akkoord', 'alle accepteren', 'alles accepteren',
        'autoriser tous les cookies', 'autoriser les cookies essentiels',
        'accepter tout', 'tout accepter', 'accept all', 'allow all',
        'tout autoriser', 'autoriser tous', 'autoriser les cookies', "j'accepte",
        'allow all cookies', 'allow essential and optional cookies',
        'decline optional cookies', 'refuser les cookies optionnels',
        'décliner les cookies facultatifs',
        "j'ai compris", 'i understand',
        'accepter', 'accept', 'agree', 'allow', 'ok', 'got it',
      ];
      const buttons = Array.from(document.querySelectorAll('button, a[role="button"], [role="button"], span[role="button"]'));
      for (const kw of keywords) {
        for (const btn of buttons) {
          const text = btn.innerText?.toLowerCase().trim();
          if (text && (text === kw || text.includes(kw))) {
            const style = getComputedStyle(btn);
            if (style.display !== 'none' && style.visibility !== 'hidden') {
              btn.click();
              return true;
            }
          }
        }
      }
      return false;
    })()`;
    const clicked = await page.evaluate(clickByTextScript);
    if (clicked) {
      await new Promise(r => setTimeout(r, 500));
    }

    // Dismiss social media login walls, signup prompts and overlays
    const dismissLoginWallsScript = `(() => {
      // Keywords that specifically indicate a modal/popup (not a navbar)
      const modalKeywords = [
        'ne manquez aucune',
        'voir plus sur facebook', 'see more on facebook',
        'mot de passe oublié', 'forgot password',
        'créer un nouveau compte', 'create new account',
        'log in or sign up to see',
      ];

      function isCloseButton(btn) {
        const btnText = btn.innerText?.trim() || '';
        const svg = btn.querySelector('svg');
        const img = btn.querySelector('img[alt*="close" i], img[alt*="fermer" i]');
        const hasCloseLabel = /close|fermer|dismiss|schliessen/i.test(btn.getAttribute('aria-label') || '');
        const isCloseChar = /^[×✕✖✗xX]$/.test(btnText);
        const isCloseIcon = (svg || img) && btnText.length <= 1;
        return isCloseIcon || isCloseChar || hasCloseLabel;
      }

      // Find the smallest (most specific) element matching modal keywords
      // This avoids hiding a large parent that contains both modal + content
      let bestMatch = null;
      let bestArea = Infinity;

      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const text = el.innerText?.toLowerCase() || '';
        if (!modalKeywords.some(kw => text.includes(kw))) continue;

        const rect = el.getBoundingClientRect();
        const area = rect.width * rect.height;
        // Must be a reasonable modal size (not too small, not the whole page)
        if (rect.width < 250 || rect.height < 200) continue;
        if (rect.width >= window.innerWidth * 0.95 && rect.height >= window.innerHeight * 0.9) continue;

        if (area < bestArea) {
          bestArea = area;
          bestMatch = el;
        }
      }

      if (bestMatch) {
        // Try to click a close button inside
        const clickables = bestMatch.querySelectorAll('button, [role="button"], span[role="button"], a, div[tabindex], i');
        for (const btn of clickables) {
          if (isCloseButton(btn)) {
            btn.click();
            return 'clicked';
          }
        }
        // Also check parent for close button (X might be outside the modal box but inside a wrapper)
        if (bestMatch.parentElement) {
          const parentClickables = bestMatch.parentElement.querySelectorAll(':scope > button, :scope > [role="button"], :scope > a, :scope > div > button');
          for (const btn of parentClickables) {
            if (isCloseButton(btn)) {
              btn.click();
              return 'clicked';
            }
          }
        }
        // No close button — hide just this element
        bestMatch.style.display = 'none';
        return 'hidden';
      }

      return false;
    })()`;
    const dismissResult = await page.evaluate(dismissLoginWallsScript);
    if (dismissResult) {
      await new Promise(r => setTimeout(r, 800));
    }

    // Clean up any remaining backdrop/overlay after modal dismissal
    await page.evaluate(`(() => {
      // Find and remove semi-transparent full-screen overlays (modal backdrops)
      // These are typically div elements with fixed position, covering the viewport,
      // with a semi-transparent background (rgba) used as backdrop behind modals
      document.querySelectorAll('div').forEach(el => {
        const s = getComputedStyle(el);
        if (s.position !== 'fixed') return;
        const rect = el.getBoundingClientRect();
        if (rect.width < window.innerWidth * 0.9 || rect.height < window.innerHeight * 0.9) return;
        const bg = s.backgroundColor;
        // Only target semi-transparent backdrops (rgba with alpha < 1)
        const rgbaMatch = bg.match(/rgba\\((\\d+),\\s*(\\d+),\\s*(\\d+),\\s*([\\d.]+)\\)/);
        if (rgbaMatch && parseFloat(rgbaMatch[4]) > 0 && parseFloat(rgbaMatch[4]) < 1) {
          el.style.display = 'none';
        }
        // Also catch elements with opacity < 1 and dark background
        if (parseFloat(s.opacity) < 1 && s.opacity !== '0') {
          const rgb = bg.match(/rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)/);
          if (rgb && parseInt(rgb[1]) < 50 && parseInt(rgb[2]) < 50 && parseInt(rgb[3]) < 50) {
            el.style.display = 'none';
          }
        }
      });
      // Re-enable scrolling (modals often disable it)
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    })()`);

    // Last resort: hide known cookie banner containers and login walls via CSS
    const hideBannersScript = `(() => {
      const sels = [
        '#onetrust-consent-sdk', '#onetrust-banner-sdk',
        '#CybotCookiebotDialog', '#cookie-law-info-bar',
        '.cookie-banner', '.cookie-consent', '.cookie-notice',
        '.gdpr-banner', '.consent-banner',
        '[class*="cookie-banner"]', '[class*="cookie-consent"]', '[class*="gdpr"]',
        '[id*="cookie-banner"]', '[id*="cookie-consent"]',
        '#qc-cmp2-container', '.didomi-popup-container', '.fc-consent-root',
        // Sourcepoint CMP (DPG Media: 7sur7, HLN, De Morgen)
        'div[id^="sp_message_container"]', '.sp-message-open',
        'iframe[id^="sp_message_iframe"]',
        // Social media specific overlays
        '[data-testid="cookie-policy-manage-dialog"]',
        '[data-testid="login_dialog"]',
        // TikTok specific
        '[class*="tiktok-cookie"]', '[data-testid*="cookie"]',
        'tiktok-cookie-banner',
      ];
      for (const sel of sels) {
        document.querySelectorAll(sel).forEach(el => { el.style.display = 'none'; });
      }
      // Hide fixed overlays that look like cookie/login backdrops (only if class name suggests it)
      document.querySelectorAll('[class*="overlay"], [class*="backdrop"], [class*="Overlay"], [class*="Backdrop"]').forEach(el => {
        const s = getComputedStyle(el);
        const cls = (el.className || '').toLowerCase();
        // Only hide if class explicitly mentions cookie/consent/login
        const isBannerRelated = /cookie|consent|gdpr|login|signup/.test(cls);
        if (isBannerRelated && s.position === 'fixed' && parseFloat(s.zIndex) > 999) {
          el.style.display = 'none';
        }
      });
      // Hide fixed top/bottom bars containing login, cookies, RGPD, or app download prompts
      document.querySelectorAll('div, section, footer, aside, header, nav').forEach(el => {
        const s = getComputedStyle(el);
        if (s.position !== 'fixed' && s.position !== 'sticky') return;
        const isBottom = s.bottom === '0px' || parseInt(s.bottom) <= 5;
        const isTop = s.top === '0px' || parseInt(s.top) <= 5;
        if (!isBottom && !isTop) return;

        const text = el.innerText?.toLowerCase() || '';
        const bannerKeywords = [
          // Login/signup prompts
          'se connecter', 'connectez-vous', 'inscrivez-vous', 'créer un nouveau compte',
          'log in', 'sign up', 'create account', 'sign in', 'create new account',
          'download the app', 'open app', 'ouvrir l\\'app', 'get the app',
          // Cookie/RGPD banners
          'accepter les cookies', 'accept cookies', 'tout autoriser', 'allow all',
          'cookies facultatifs', 'optional cookies', 'politique relative aux cookies',
          'cookie policy', 'décliner les cookies', 'decline cookies',
          // RGPD/privacy notices
          'transfert de données', 'transferts de données', 'data transfer',
          'j\\'ai compris', 'i understand', 'got it',
        ];
        if (bannerKeywords.some(kw => text.includes(kw))) {
          el.style.display = 'none';
        }
      });

      // Hide floating info popups (TikTok keyboard shortcuts, etc.)
      document.querySelectorAll('div, aside').forEach(el => {
        const s = getComputedStyle(el);
        if (s.position !== 'fixed' && s.position !== 'absolute') return;
        const rect = el.getBoundingClientRect();
        // Small popup (not a full-width bar)
        if (rect.width > window.innerWidth * 0.5) return;
        if (rect.width < 100 || rect.height < 50) return;
        const text = el.innerText?.toLowerCase() || '';
        const popupKeywords = [
          'raccourcis clavier', 'keyboard shortcuts',
          'réactiver le son', 'unmute', 'turn on sound',
        ];
        if (popupKeywords.some(kw => text.includes(kw))) {
          el.style.display = 'none';
        }
      });
      // Re-enable scrolling on body (often disabled by modals)
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    })()`;
    await page.evaluate(hideBannersScript);
  } catch (err) {
    // Non-critical: if banner dismissal fails, proceed with capture anyway
    console.warn('Cookie banner dismissal failed (non-critical):', err);
  }
}

interface PageCapture {
  screenshotPath: string | null;
  articleText: string;
  articleHtml: string;
  pageTitle: string | null;
}

async function captureScreenshot(url: string, filename: string, userId?: string): Promise<string | null> {
  const result = await capturePage(url, filename, userId);
  return result.screenshotPath;
}

async function capturePage(url: string, filename: string, userId?: string): Promise<PageCapture> {
  let browser: any = null;
  try {
    const puppeteer = await import('puppeteer-core');
    const bypassRule = getBypassRules(url);

    browser = await puppeteer.default.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
      ],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // --- Bypass: User-Agent ---
    const ua = getUA(bypassRule);
    await page.setUserAgent(ua);

    // --- Bypass: Extra headers (Referer, X-Forwarded-For) ---
    const extraHeaders = getExtraHeaders(bypassRule);
    if (Object.keys(extraHeaders).length > 0) {
      await page.setExtraHTTPHeaders(extraHeaders);
    }

    // --- Bypass: Clear cookies for metered paywalls ---
    if (bypassRule && !bypassRule.allowCookies) {
      const client = await page.target().createCDPSession();
      await client.send('Network.clearBrowserCookies');
    }

    // --- Block consent/cookie CMP scripts + paywall scripts ---
    // Always intercept requests to block consent popups on ALL sites
    // IMPORTANT: only block script/xhr/fetch resources, NEVER block document navigations
    await page.setRequestInterception(true);
    const paywallPatterns = bypassRule?.blockPatterns || [];
    page.on('request', (req: any) => {
      const reqUrl = req.url();
      const resourceType = req.resourceType();
      // Never block page navigations (document) or images/fonts/media
      const blockableTypes = ['script', 'xhr', 'fetch', 'stylesheet'];
      if (blockableTypes.includes(resourceType)) {
        // Block known consent/cookie management platforms (universal)
        if (CONSENT_SCRIPT_PATTERNS.some((p: RegExp) => p.test(reqUrl))) {
          req.abort();
          return;
        }
        // Block paywall scripts (per-domain rules)
        if (paywallPatterns.length > 0 && paywallPatterns.some((p: RegExp) => p.test(reqUrl))) {
          req.abort();
          return;
        }
      }
      req.continue();
    });

    // --- Anti-detection: spoof webdriver, plugins, languages ---
    await page.evaluateOnNewDocument(`(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['fr-BE', 'fr', 'en'] });
      window.chrome = { runtime: {} };
    })()`);

    // --- Apply stored auth cookies from browser extension (if user is known) ---
    if (userId && bypassRule?.allowCookies !== false) {
      try {
        const { detectPlatformFromUrl } = await import('../utils/platformDetect');
        const platform = detectPlatformFromUrl(url);
        if (platform) {
          const { applyStoredCookies } = await import('../utils/applyStoredCookies');
          await applyStoredCookies(page, userId, platform);
        }
      } catch (err) {
        console.warn('[clipper] applyStoredCookies failed:', err instanceof Error ? err.message : err);
      }
    }

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });

    // Wait for CSS/fonts/images to fully render
    await new Promise(r => setTimeout(r, 3000));

    // --- Bypass: DPG Media consent redirect ---
    // DPG redirects to myprivacy.dpgmedia.be/consent which renders a CMP that
    // doesn't work in headless Chrome. The page defines a redirect() function
    // that navigates to the callback URL — we call it directly.
    const currentUrl = page.url();
    if (currentUrl.includes('myprivacy.dpgmedia.be/consent')) {
      console.log(`[Clipper] DPG consent redirect detected, calling redirect()...`);
      try {
        await page.evaluate('if (typeof redirect === "function") redirect();');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 3000));
        console.log(`[Clipper] DPG consent bypassed, now at: ${page.url()}`);
      } catch (err) {
        console.warn('[Clipper] DPG consent bypass failed:', err);
      }
    }

    // --- Cleanup: Remove DPG consent overlay that persists after redirect ---
    await page.evaluate(`(() => {
      // DPG consent modal overlay
      const modal = document.querySelector('#message.modal');
      if (modal) modal.remove();
      // DPG consent container/backdrop
      document.querySelectorAll('.modal-backdrop, [class*="consent-overlay"], [class*="privacy-gate"]').forEach(el => el.remove());
      // Any remaining fixed overlay from DPG
      document.querySelectorAll('div').forEach(el => {
        const s = getComputedStyle(el);
        if (s.position === 'fixed' && parseInt(s.zIndex) >= 999) {
          const text = (el.innerText || '').toLowerCase();
          if (/confidentialit|privacy|cookie|consent|dpg/i.test(text) || el.querySelector('img[src*="dpgmedia"]')) {
            el.remove();
          }
        }
      });
      // Restore scroll
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    })()`);

    // --- Bypass: Check for Sourcepoint CMP iframe (DPG Media) ---
    await dismissSourcepointCMP(page);

    // Dismiss cookie/GDPR banners automatically
    await dismissCookieBanners(page);

    // Wait for delayed modals (Instagram signup prompt appears after ~2s)
    await new Promise(r => setTimeout(r, 2000));

    // Second pass: dismiss any modals that appeared after the delay
    await dismissCookieBanners(page);

    // Brief settle time after second pass
    await new Promise(r => setTimeout(r, 1000));

    // --- Bypass: Remove paywall overlays & unhide content ---
    if (bypassRule) {
      await applyDomBypass(page, bypassRule);
    }

    // --- Bypass: Try extracting article from JSON-LD (fallback enrichment) ---
    // This doesn't affect the screenshot but logs if full article was found
    const hasJsonArticle = await page.evaluate(`(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of Array.from(scripts)) {
        try {
          const d = JSON.parse(s.textContent || '');
          if (d.articleBody) return true;
          if (Array.isArray(d) && d.some(i => i.articleBody)) return true;
        } catch {}
      }
      return false;
    })()`);
    if (hasJsonArticle) {
      console.log(`[Clipper] JSON-LD articleBody found for ${url} — full article available`);
    }

    // Force full page height: remove overflow:hidden, scroll to trigger lazy-loading
    await page.evaluate(() => {
      document.documentElement.style.overflow = 'visible';
      document.body.style.overflow = 'visible';
      document.documentElement.style.height = 'auto';
      document.body.style.height = 'auto';
      // Remove position:fixed/sticky elements that clip content
      document.querySelectorAll('*').forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'sticky') {
          (el as HTMLElement).style.position = 'absolute';
        }
      });
    });

    // Scroll to bottom to trigger lazy-loaded content, then back to top
    await page.evaluate(async () => {
      const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
      const height = document.body.scrollHeight;
      for (let y = 0; y < height; y += 500) {
        window.scrollTo(0, y);
        await delay(100);
      }
      window.scrollTo(0, 0);
      await delay(500);
    });

    // --- Final cleanup: aggressively remove consent overlays before screenshot ---
    // The consent popup may re-inject after navigation, so poll + click + nuke
    await dismissConsentOverlays(page);

    const screenshotDir = path.join(UPLOAD_DIR, 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    const filepath = path.join(screenshotDir, filename);
    await page.screenshot({ path: filepath, fullPage: true });

    // Extract main page content (article / main / role=main / body) — used to
    // populate the note when the user did not paste content manually in the
    // dialog. Run BEFORE closing the browser.
    const extracted = await page.evaluate(() => {
      const pickEl = () =>
        document.querySelector('article')
        || document.querySelector('[role="main"]')
        || document.querySelector('main')
        || document.body;

      const el = pickEl();
      if (!el) return { html: '', text: '', title: '' };

      // Strip script/style/noscript before reading text
      const clone = el.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('script, style, noscript, iframe, [aria-hidden="true"]').forEach((n) => n.remove());

      const text = (clone.textContent || '').replace(/\s+/g, ' ').trim();
      // Cap at 50KB HTML / 30KB text
      const html = clone.innerHTML.length > 50000 ? clone.innerHTML.slice(0, 50000) : clone.innerHTML;
      const limitedText = text.length > 30000 ? text.slice(0, 30000) : text;
      return {
        html,
        text: limitedText,
        title: document.title || '',
      };
    }).catch(() => ({ html: '', text: '', title: '' }));

    await browser.close();
    browser = null;

    console.log(`[Clipper] Screenshot captured: ${filepath}, extracted ${extracted.text.length} chars of text`);
    return {
      screenshotPath: `uploads/screenshots/${filename}`,
      articleText: extracted.text,
      articleHtml: extracted.html,
      pageTitle: extracted.title || null,
    };
  } catch (err: any) {
    console.error(`[Clipper] Screenshot capture FAILED for ${url}: ${err?.message || err}`);
    if (browser) {
      try { await browser.close(); } catch (_) { /* ignore */ }
    }
    return { screenshotPath: null, articleText: '', articleHtml: '', pageTitle: null };
  }
}

/**
 * Dismiss Sourcepoint CMP consent dialog (used by DPG Media, VRT, etc.)
 * These CMPs render inside an iframe, so we need to switch context.
 */
async function dismissSourcepointCMP(page: any): Promise<void> {
  try {
    // Sourcepoint renders in an iframe with src containing "sourcepoint" or class "sp-message-iframe"
    const iframeHandle = await page.$('iframe[id^="sp_message_iframe"], iframe[class*="sp-message"], iframe[title*="SP Consent"]');
    if (iframeHandle) {
      const frame = await iframeHandle.contentFrame();
      if (frame) {
        // Try common Sourcepoint accept buttons inside the iframe
        const spSelectors = [
          'button[title="D\'accord"]',
          'button[title="Akkoord"]',
          'button[title="Agree"]',
          'button[title="Accept"]',
          'button[title="OK"]',
          'button.sp_choice_type_11',
          'button[aria-label="D\'accord"]',
          'button[aria-label="Akkoord"]',
        ];
        for (const sel of spSelectors) {
          try {
            const btn = await frame.$(sel);
            if (btn) {
              await btn.click();
              await new Promise(r => setTimeout(r, 500));
              return;
            }
          } catch {}
        }
        // Fallback: find button by text content inside iframe
        const clicked = await frame.evaluate(() => {
          const keywords = ["d'accord", 'akkoord', 'agree', 'accept', 'ok'];
          const buttons = Array.from(document.querySelectorAll('button'));
          for (const kw of keywords) {
            for (const btn of buttons) {
              const text = btn.innerText?.toLowerCase().trim();
              if (text && (text === kw || text.includes(kw))) {
                btn.click();
                return true;
              }
            }
          }
          return false;
        });
        if (clicked) {
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }
  } catch (err) {
    // Non-critical
    console.warn('[Clipper] Sourcepoint CMP dismissal failed (non-critical):', err);
  }
}

/**
 * Apply DOM-level bypass: remove paywall overlays, unhide content, strip classes.
 */
async function applyDomBypass(page: any, rule: import('../utils/bypassRules').BypassRule): Promise<void> {
  try {
    const removeSelectors = rule.removeSelectors || [];
    const unhideSelectors = rule.unhideSelectors || [];
    const stripClasses = rule.stripClasses || [];

    await page.evaluate((removeSels: string[], unhideSels: string[], stripCls: string[]) => {
      // Remove paywall elements
      for (const sel of removeSels) {
        document.querySelectorAll(sel).forEach(el => el.remove());
      }
      // Unhide blurred/locked content
      for (const sel of unhideSels) {
        document.querySelectorAll(sel).forEach(el => {
          (el as HTMLElement).style.filter = 'none';
          (el as HTMLElement).style.webkitFilter = 'none';
          (el as HTMLElement).style.overflow = 'visible';
          (el as HTMLElement).style.maxHeight = 'none';
          (el as HTMLElement).style.display = '';
        });
      }
      // Strip paywall-related classes
      if (stripCls.length > 0) {
        document.querySelectorAll('*').forEach(el => {
          for (const cls of stripCls) {
            el.classList.remove(cls);
          }
        });
      }
      // Restore body scroll
      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    }, removeSelectors, unhideSelectors, stripClasses);
  } catch (err) {
    console.warn('[Clipper] DOM bypass failed (non-critical):', err);
  }
}

/**
 * Final aggressive cleanup of consent/cookie overlays right before screenshot.
 * Polls for dynamically-injected consent popups, tries clicking accept buttons,
 * then force-removes any remaining overlay by structure/content.
 */
async function dismissConsentOverlays(page: any): Promise<void> {
  try {
    // Step 1: Poll up to 3 seconds for a consent "accept" button to appear and click it
    for (let i = 0; i < 6; i++) {
      const clicked = await page.evaluate(`(() => {
        // Try clicking buttons by text
        const keywords = ["d'accord", "akkoord", "accept all", "accepter tout", "tout accepter",
          "allow all", "agree", "j'accepte", "ok, got it", "got it"];
        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
        for (const kw of keywords) {
          for (const btn of buttons) {
            const text = (btn.innerText || '').toLowerCase().trim();
            if (text && (text === kw || text.startsWith(kw))) {
              const s = getComputedStyle(btn);
              if (s.display !== 'none' && s.visibility !== 'hidden' && btn.offsetWidth > 0) {
                btn.click();
                return kw;
              }
            }
          }
        }
        return null;
      })()`);
      if (clicked) {
        console.log(`[Clipper] Clicked consent button: "${clicked}"`);
        await new Promise(r => setTimeout(r, 1500));
        break;
      }

      // Also check inside iframes
      const frames = page.frames();
      for (const frame of frames) {
        if (frame === page.mainFrame()) continue;
        try {
          const iframeClicked = await frame.evaluate(() => {
            const keywords = ["d'accord", "akkoord", "accept", "agree", "ok"];
            const buttons = Array.from(document.querySelectorAll('button'));
            for (const kw of keywords) {
              for (const btn of buttons) {
                if ((btn.innerText || '').toLowerCase().includes(kw) && btn.offsetWidth > 0) {
                  btn.click();
                  return btn.innerText.trim();
                }
              }
            }
            return null;
          }).catch(() => null);
          if (iframeClicked) {
            console.log(`[Clipper] Clicked consent in iframe: "${iframeClicked}"`);
            await new Promise(r => setTimeout(r, 1500));
            break;
          }
        } catch {}
      }

      await new Promise(r => setTimeout(r, 500));
    }

    // Step 2: Force-remove any remaining consent/privacy overlay from the DOM
    await page.evaluate(`(() => {
      // Known consent container selectors
      const selectors = [
        '#message.modal', '#consent-modal', '#privacy-modal',
        'div[id^="sp_message_container"]', 'iframe[id^="sp_message_iframe"]',
        '#onetrust-consent-sdk', '#CybotCookiebotDialog',
        '.qc-cmp2-container', '.didomi-popup-container', '.fc-consent-root',
        '[class*="consent-overlay"]', '[class*="privacy-gate"]',
        '.modal-backdrop', '.consent-wall',
      ];
      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => el.remove());
      });

      // Remove any large overlay containing consent keywords + buttons/logo
      const consentRe = /paramètres de confidentialit|cookie.?policy|privacy.?settings|vos param|dpgmedia/i;
      const buttonRe = /d.accord|akkoord|accept|modifier manuellement|manage preferences/i;
      document.querySelectorAll('div, section, aside, dialog, form').forEach(el => {
        if (el.tagName === 'BODY' || el.tagName === 'HTML') return;
        if (el.closest('article') || el.querySelector('article')) return;
        const rect = el.getBoundingClientRect();
        if (rect.width < 250 || rect.height < 150) return;
        const text = (el.innerText || '').substring(0, 1000);
        if (!consentRe.test(text)) return;
        if (buttonRe.test(text) || el.querySelector('img[src*="dpgmedia"], img[src*="consent"], img[alt*="dpg"]')) {
          el.remove();
        }
      });

      // Nuclear option: remove ALL fixed/absolute overlays with high z-index that aren't the nav
      document.querySelectorAll('div').forEach(el => {
        const s = getComputedStyle(el);
        const z = parseInt(s.zIndex) || 0;
        if ((s.position === 'fixed' || s.position === 'absolute') && z >= 500) {
          const rect = el.getBoundingClientRect();
          // Large centered overlay (not a narrow nav bar)
          if (rect.width > 300 && rect.height > 200 && rect.width < window.innerWidth * 0.9) {
            const text = (el.innerText || '').toLowerCase();
            if (/confidentialit|consent|cookie|privacy|d.accord|akkoord/.test(text)) {
              el.remove();
            }
          }
        }
      });

      // Remove any backdrop (semi-transparent full-screen overlay)
      document.querySelectorAll('div').forEach(el => {
        const s = getComputedStyle(el);
        if (s.position !== 'fixed' && s.position !== 'absolute') return;
        const rect = el.getBoundingClientRect();
        if (rect.width < window.innerWidth * 0.8 || rect.height < window.innerHeight * 0.8) return;
        const bg = s.backgroundColor;
        const rgba = bg.match(/rgba\\((\\d+),\\s*(\\d+),\\s*(\\d+),\\s*([\\d.]+)\\)/);
        if (rgba && parseFloat(rgba[4]) > 0 && parseFloat(rgba[4]) < 1) {
          el.remove();
        }
      });

      document.body.style.overflow = 'auto';
      document.documentElement.style.overflow = 'auto';
    })()`);
  } catch (err) {
    console.warn('[Clipper] Consent overlay cleanup failed (non-critical):', err);
  }
}

/**
 * Web Clipper — captures web content as a note node in a dossier.
 * POST /api/clip
 * Body: { dossierId, parentId?, title, url, content (HTML string), textContent? }
 */
export async function clipWebContent(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { dossierId, parentId, title, url, content, textContent } = req.body;

    if (!dossierId || !title || !content) {
      res.status(400).json({ error: 'dossierId, title et content requis' });
      return;
    }

    const dossier = await Dossier.findById(dossierId);
    if (!dossier) { res.status(404).json({ error: 'Dossier introuvable' }); return; }
    const hasAccess = dossier.owner.toString() === userId || dossier.collaborators.map(c => c.toString()).includes(userId);
    if (!hasAccess) { res.status(403).json({ error: 'Accès refusé' }); return; }

    // Capture screenshot AND extract page content BEFORE creating node
    const filename = `clip-${Date.now()}.png`;
    console.log(`[Clipper] url="${url}", title="${title}", will capture page: ${!!url}`);
    const captured = url
      ? await capturePage(url, filename, userId)
      : { screenshotPath: null as string | null, articleText: '', articleHtml: '', pageTitle: null as string | null };
    const screenshotPath = captured.screenshotPath;
    console.log(`[Clipper] screenshotPath=${screenshotPath}, articleText=${captured.articleText.length} chars`);
    const baseUrl = getBaseUrl(req);

    // Detect "fallback content" sent by the dialog when the user did not paste
    // anything (HTML wrapping the i18n placeholder). In that case we prefer the
    // server-extracted article text.
    const fallbackPattern = /<p>\s*(?:Contenu\s+capturé\s+depuis|Content\s+captured\s+from|Inhoud\s+vastgelegd\s+van)/i;
    const userPastedNothing = !content || fallbackPattern.test(content);
    const effectiveText = (userPastedNothing && captured.articleText)
      ? captured.articleText
      : (textContent || (typeof content === 'string' ? content.replace(/<[^>]+>/g, ' ').substring(0, 50000) : ''));

    // Build TipTap-compatible JSON content
    const tiptapNodes: any[] = [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: title }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Source : ' },
          {
            type: 'text',
            marks: [{ type: 'link', attrs: { href: url, target: '_blank' } }],
            text: url,
          },
        ],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            marks: [{ type: 'italic' }],
            text: `Capturé le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
          },
        ],
      },
      { type: 'horizontalRule' },
    ];

    // Add screenshot if captured (relative URL — works on any host/port)
    if (screenshotPath) {
      tiptapNodes.push({
        type: 'image',
        attrs: {
          src: toAbsoluteUrlFromBase(screenshotPath, baseUrl),
          alt: `Capture de ${title}`,
          title: `Screenshot - ${url}`,
        },
      });
    }

    // Add text content — split on paragraph breaks so the editor renders proper
    // paragraphs instead of a single wall of text.
    const paragraphs: string[] = effectiveText
      .split(/\n{2,}|(?<=[.!?])\s{2,}/)
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 0);

    if (paragraphs.length === 0 && effectiveText) paragraphs.push(effectiveText);

    for (const p of paragraphs) {
      tiptapNodes.push({
        type: 'paragraph',
        content: [{ type: 'text', text: p }],
      });
    }

    const tiptapContent = { type: 'doc', content: tiptapNodes };

    const lastNode = await DossierNode.findOne({
      dossierId,
      parentId: parentId || null,
    }).sort({ order: -1 });

    // Compute hash of screenshot if captured
    let screenshotHash: string | null = null;
    let screenshotAbsPath: string | null = null;
    let screenshotSize = 0;
    if (screenshotPath) {
      screenshotAbsPath = path.join(UPLOAD_DIR, 'screenshots', filename);
      screenshotHash = await computeFileHash(screenshotAbsPath);
      const stat = fs.statSync(screenshotAbsPath);
      screenshotSize = stat.size;
    }

    const node = await DossierNode.create({
      dossierId,
      parentId: parentId || null,
      type: 'note',
      title: `📎 ${title}`,
      content: tiptapContent,
      contentText: textContent || content.replace(/<[^>]+>/g, ' ').substring(0, 50000),
      fileUrl: screenshotPath || undefined,
      order: lastNode ? lastNode.order + 1 : 0,
    });

    const dossierDoc = await Dossier.findById(dossierId).select('isEmbargo').lean();
    if (!dossierDoc?.isEmbargo) {
      const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
      const ua = req.headers['user-agent'] || '';
      await logActivity(userId, 'clip.create', 'dossier', dossierId, { nodeId: node._id.toString(), url, title }, ip, ua);
    }

    res.status(201).json(node);
  } catch (error) {
    console.error('Clip error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

/**
 * Returns a list of dossiers the user can clip into.
 * GET /api/clip/dossiers
 */
export async function getClipDossiers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const dossiers = await Dossier.find({
      $or: [{ owner: userId }, { collaborators: userId }],
    }).select('_id title').sort({ updatedAt: -1 }).limit(50);
    res.json(dossiers);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

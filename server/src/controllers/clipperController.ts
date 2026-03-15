import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { AuthRequest } from '../middleware/auth';
import DossierNode from '../models/DossierNode';
import Dossier from '../models/Dossier';
import { logActivity } from '../utils/activityLogger';
import { computeFileHash } from '../utils/hashFile';

const UPLOAD_DIR = path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || './uploads');

/**
 * Attempts to dismiss cookie/GDPR consent banners by clicking common accept buttons
 * and hiding known cookie banner elements.
 */
async function dismissCookieBanners(page: any): Promise<void> {
  try {
    // Common selectors for "accept all cookies" buttons across various consent frameworks
    const acceptSelectors = [
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

async function captureScreenshot(url: string, filename: string): Promise<string | null> {
  let browser: any = null;
  try {
    const puppeteer = await import('puppeteer');
    browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Dismiss cookie/GDPR banners automatically
    await dismissCookieBanners(page);

    // Wait for delayed modals (Instagram signup prompt appears after ~2s)
    await new Promise(r => setTimeout(r, 2000));

    // Second pass: dismiss any modals that appeared after the delay
    await dismissCookieBanners(page);

    // Brief settle time after second pass
    await new Promise(r => setTimeout(r, 500));

    const screenshotDir = path.join(UPLOAD_DIR, 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    const filepath = path.join(screenshotDir, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    await browser.close();
    browser = null;

    console.log(`Screenshot captured: ${filepath}`);
    return `uploads/screenshots/${filename}`;
  } catch (err) {
    console.error('Screenshot capture failed:', err);
    if (browser) {
      try { await browser.close(); } catch (_) { /* ignore */ }
    }
    return null;
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

    // Capture screenshot BEFORE creating node
    const filename = `clip-${Date.now()}.png`;
    const screenshotPath = url ? await captureScreenshot(url, filename) : null;

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

    // Add screenshot if captured
    if (screenshotPath) {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const serverBase = `${protocol}://${host}`;
      tiptapNodes.push({
        type: 'image',
        attrs: {
          src: `${serverBase}/${screenshotPath}`,
          alt: `Capture de ${title}`,
          title: `Screenshot - ${url}`,
        },
      });
    }

    // Add text content
    tiptapNodes.push({
      type: 'paragraph',
      content: [{ type: 'text', text: textContent || content.replace(/<[^>]+>/g, ' ').substring(0, 50000) }],
    });

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

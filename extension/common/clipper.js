// Full-page screenshot via scroll + stitching.
// Works on both Chrome and Firefox (no debugger API required).
//
// Strategy v2 (after Firefox stitching artifacts):
//   1. Inject a content script that:
//      - Reads page dimensions and devicePixelRatio
//      - Hides position:fixed/sticky elements during capture
//      - Disables CSS smooth-scroll
//   2. Scroll to each viewport position. After scrolling, READ the actual
//      scroll position (the page may stop short or overshoot, especially
//      on lazy-loaded sites).
//   3. Capture each viewport. Decode the image immediately to get its
//      REAL dimensions in pixels — we no longer assume each capture is
//      exactly viewportHeight × dpr (Firefox can return slightly different
//      sizes, e.g. when scrollbars appear/disappear).
//   4. Re-evaluate scrollHeight at each step in case lazy loading extends
//      the page.
//   5. Composite using each slice's actual y position and actual image
//      dimensions. Later slices overwrite earlier ones in the overlap zone,
//      which is the correct behavior (the latest paint wins).
//   6. Always restore page state in finally.
//
// Browser-specific:
//   Firefox repaints more slowly than Chrome. Use longer settle delays.

const isFirefox = typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);

// Time to wait after scrolling before capturing (lets the browser repaint
// and lazy-loaded images decode). Firefox needs noticeably more.
const SCROLL_SETTLE_MS = isFirefox ? 450 : 200;

// captureVisibleTab is rate-limited (~2/sec on Chrome, similar on Firefox).
// Throttle between captures to avoid quota errors.
const CAPTURE_DELAY_MS = isFirefox ? 800 : 600;

// Hard cap on the number of slices to avoid runaway captures on very long
// or infinite-scroll pages.
const MAX_SLICES = 60;

/**
 * Capture the full scrollable page of a given tab.
 * @param {number} tabId
 * @param {(pct:number, label:string)=>void} onProgress
 * @returns {Promise<string>} base64 PNG data URL
 */
export async function captureFullPage(tabId, onProgress = () => {}) {
  onProgress(0.02, 'Préparation…');

  // Step 1: prepare the page (hide sticky, disable smooth scroll, save state)
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const html = document.documentElement;
      const body = document.body;

      window.__meteoreditSavedScroll = {
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        htmlScrollBehavior: html.style.scrollBehavior,
        bodyScrollBehavior: body.style.scrollBehavior,
      };

      html.style.scrollBehavior = 'auto';
      body.style.scrollBehavior = 'auto';

      const stickies = [];
      for (const el of document.querySelectorAll('*')) {
        const cs = window.getComputedStyle(el);
        if (cs.position === 'fixed' || cs.position === 'sticky') {
          stickies.push({ el, prevVisibility: el.style.visibility });
          el.style.visibility = 'hidden';
        }
      }
      window.__meteoreditStickyHidden = stickies;

      // Force layout recompute now that sticky/fixed are hidden
      void html.offsetHeight;
    },
  });

  const slices = [];
  let prevActualY = -1;
  let stuckCount = 0;

  try {
    for (let step = 0; step < MAX_SLICES; step++) {
      // Read current page dimensions (may grow during capture due to lazy loading)
      const [{ result: dims }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const h = document.documentElement;
          const b = document.body;
          return {
            scrollHeight: Math.max(
              h.scrollHeight, b.scrollHeight,
              h.offsetHeight, b.offsetHeight,
              h.clientHeight
            ),
            scrollWidth: Math.max(
              h.scrollWidth, b.scrollWidth,
              h.offsetWidth, b.offsetWidth,
              h.clientWidth
            ),
            viewportHeight: window.innerHeight,
            dpr: window.devicePixelRatio || 1,
          };
        },
      });
      const targetY = step * dims.viewportHeight;

      // Scroll to target
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (yy) => window.scrollTo(0, yy),
        args: [targetY],
      });
      await sleep(SCROLL_SETTLE_MS);

      // Read the actual scroll position the page accepted.
      // Use pageYOffset which is the most consistent across browsers.
      const [{ result: actualY }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => Math.round(window.pageYOffset || window.scrollY || 0),
      });

      // Capture viewport
      onProgress(Math.min(0.9, (step + 1) / Math.max(2, Math.ceil(dims.scrollHeight / dims.viewportHeight))), `Capture ${step + 1}…`);
      const dataUrl = await captureWithRetry(tabId);

      // Decode the image immediately so we know its real dimensions and can
      // include them in the slice metadata. This is critical: Firefox can
      // return slightly different image sizes than (viewportHeight × dpr).
      const img = await loadImage(dataUrl);
      slices.push({ y: actualY, img, w: img.naturalWidth, h: img.naturalHeight });

      // Stop conditions:
      //   - We've reached or passed the bottom (actualY + viewportHeight >= scrollHeight)
      //   - The scroll position didn't advance (page is shorter than expected)
      const reachedBottom = actualY + dims.viewportHeight >= dims.scrollHeight - 1;
      if (actualY === prevActualY) {
        stuckCount++;
        if (stuckCount >= 1) break; // page won't scroll further
      } else {
        stuckCount = 0;
      }
      prevActualY = actualY;
      if (reachedBottom) break;

      await sleep(CAPTURE_DELAY_MS);
    }
  } finally {
    // Always restore the page state, even on error
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const saved = window.__meteoreditSavedScroll;
        const stickies = window.__meteoreditStickyHidden ?? [];
        for (const s of stickies) {
          try { s.el.style.visibility = s.prevVisibility ?? ''; } catch { /* ignore */ }
        }
        if (saved) {
          document.documentElement.style.scrollBehavior = saved.htmlScrollBehavior ?? '';
          document.body.style.scrollBehavior = saved.bodyScrollBehavior ?? '';
          window.scrollTo(saved.scrollX, saved.scrollY);
        }
        delete window.__meteoreditStickyHidden;
        delete window.__meteoreditSavedScroll;
      },
    }).catch(() => { /* tab may have navigated */ });
  }

  if (slices.length === 0) {
    throw new Error('Aucune capture obtenue');
  }

  onProgress(0.95, 'Assemblage…');

  // Determine the canvas size from the actual captured slices.
  //   - Width: max image width across all slices
  //   - Height: (last slice's y in CSS px × dpr) + last slice's image height
  // We compute dpr from the largest slice (image w / inner page width should
  // give the same ratio everywhere, but we re-check for safety).
  const maxImgW = Math.max(...slices.map((s) => s.w));
  const last = slices[slices.length - 1];
  // Get the dpr from the last sample we have. We approximate by reading the
  // image-to-CSS ratio: if we know the CSS scrollY at capture time and the
  // image height, the dpr is image.h / (number of CSS px captured).
  // Simpler: take dpr from the prep step we did at the very start.
  const [{ result: finalDpr }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.devicePixelRatio || 1,
  });
  const dpr = finalDpr || 1;

  // Total height in image pixels: last slice top (CSS y × dpr) + its image height.
  const totalH = Math.round(last.y * dpr) + last.h;
  const canvas = new OffscreenCanvas(maxImgW, totalH);
  const ctx = canvas.getContext('2d');

  for (const slice of slices) {
    ctx.drawImage(slice.img, 0, Math.round(slice.y * dpr));
  }

  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const finalDataUrl = await blobToDataUrl(blob);
  onProgress(1, 'Capture terminée');
  return finalDataUrl;
}

async function captureWithRetry(tabId, maxAttempts = 3) {
  let lastErr;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await chrome.tabs.captureVisibleTab(undefined, { format: 'png' });
    } catch (err) {
      lastErr = err;
      await sleep(800 * (i + 1));
    }
  }
  throw lastErr ?? new Error('captureVisibleTab failed');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

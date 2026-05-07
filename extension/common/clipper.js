// Full-page screenshot via scroll + stitching.
// Works on both Chrome and Firefox (no debugger API required).
//
// Strategy v3 (after Firefox showed huge gaps with the actualY×dpr layout):
//   We no longer trust window.pageYOffset to position slices in the canvas.
//   Each captured slice is appended END-TO-END to the canvas: every new slice
//   starts exactly where the previous one ended in image-pixel space.
//
//   To handle the case where the scroll didn't fully advance (e.g. last
//   viewport at the bottom of the page), we compare the requested CSS scroll
//   step (viewportHeight) with what the page actually accepted (actualY −
//   prevActualY). The difference, scaled by the effective dpr, tells us how
//   many pixels at the TOP of the new slice overlap with the bottom of the
//   previous slice. We crop those out before drawing.
//
//   This makes the stitch independent of any cross-browser oddity in the
//   reported scroll position vs the actual captured image.

const isFirefox = typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);

// Time to wait after scrolling before capturing. Firefox repaints noticeably
// slower than Chrome.
const SCROLL_SETTLE_MS = isFirefox ? 500 : 200;

// captureVisibleTab is rate-limited (~2/sec). Throttle between captures.
const CAPTURE_DELAY_MS = isFirefox ? 800 : 600;

// Hard cap on the number of slices to avoid runaway captures on infinite-scroll pages.
const MAX_SLICES = 60;

/**
 * Capture the full scrollable page of a given tab.
 * @param {number} tabId
 * @param {(pct:number, label:string)=>void} onProgress
 * @returns {Promise<string>} base64 PNG data URL
 */
export async function captureFullPage(tabId, onProgress = () => {}) {
  onProgress(0.02, 'Préchargement de la page…');

  // Step 0: pre-scroll the whole page top→bottom→top so lazy images,
  // skeletons and IntersectionObserver-driven sections (hero pictures,
  // "Related news" cards, sticky banners) hydrate BEFORE we start the actual
  // capture. Without this, screenshots show a blank hero band at the top and
  // grey skeletons at the bottom on sites that lazy-load below the fold.
  await chrome.scripting.executeScript({
    target: { tabId },
    func: async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const prevHtmlBhv = document.documentElement.style.scrollBehavior;
      const prevBodyBhv = document.body.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      document.body.style.scrollBehavior = 'auto';

      const initial = { x: window.scrollX, y: window.scrollY };
      const docHeight = () => Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        document.documentElement.offsetHeight,
        document.body.offsetHeight,
      );

      const step = Math.max(200, Math.round(window.innerHeight * 0.7));
      let y = 0;
      let lastY = -1;
      let safety = 0;
      while (y < docHeight() && safety++ < 80) {
        window.scrollTo(0, y);
        await sleep(180);
        if (y === lastY) break;
        lastY = y;
        y += step;
      }
      window.scrollTo(0, docHeight());
      await sleep(400);

      // Wait for any remaining images to load + decode
      const imgs = Array.from(document.images || []);
      await Promise.all(imgs.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise((res) => {
          const done = () => res();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
          setTimeout(done, 1500); // per-image safety timeout
        });
      }));

      // One more tick for IntersectionObserver callbacks that fire after the
      // image load (skeletons replaced by real cards).
      await sleep(700);

      // Back to top before the real capture loop kicks in.
      window.scrollTo(initial.x, 0);
      document.documentElement.style.scrollBehavior = prevHtmlBhv;
      document.body.style.scrollBehavior = prevBodyBhv;
      await sleep(300);
    },
  });

  // Step 1: prepare the page (hide sticky/fixed, disable smooth-scroll, save state)
  const [{ result: prep }] = await chrome.scripting.executeScript({
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

      void html.offsetHeight; // force layout

      return {
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        dpr: window.devicePixelRatio || 1,
      };
    },
  });

  const viewportHeight = prep.viewportHeight; // CSS px
  const cssScrollStep = Math.max(1, viewportHeight - 1); // -1 to avoid losing 1 px between slices on some browsers

  /** @type {Array<{ img: HTMLImageElement, drawTopOffset: number }>} */
  const slices = [];
  let canvasW = 0;
  let canvasH = 0;
  let prevActualY = -1;
  let stuckCount = 0;
  // Effective dpr is measured after the first capture, by dividing the
  // captured image's height by the viewport's CSS height.
  let effectiveDpr = prep.dpr;

  try {
    for (let step = 0; step < MAX_SLICES; step++) {
      // Re-measure scrollHeight at every step (lazy loading may extend the page)
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
          };
        },
      });

      const targetY = step * cssScrollStep;

      await chrome.scripting.executeScript({
        target: { tabId },
        func: (yy) => window.scrollTo(0, yy),
        args: [targetY],
      });
      await sleep(SCROLL_SETTLE_MS);

      const [{ result: actualY }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => Math.round(window.pageYOffset || window.scrollY || 0),
      });

      onProgress(Math.min(0.9, (step + 1) / Math.max(2, Math.ceil(dims.scrollHeight / cssScrollStep))), `Capture ${step + 1}…`);
      const dataUrl = await captureWithRetry(tabId);
      const img = await loadImage(dataUrl);

      // Compute effective dpr from the very first slice. This is the ratio
      // image-pixels-per-CSS-pixel that captureVisibleTab actually used —
      // not always equal to window.devicePixelRatio (Firefox sometimes returns
      // images sized differently than expected).
      if (step === 0) {
        effectiveDpr = img.naturalHeight / viewportHeight;
        canvasW = img.naturalWidth;
      }

      // Determine how many top pixels of THIS slice overlap with the previous
      // slice. Overlap happens when the page didn't scroll a full cssScrollStep
      // (typically on the last slice when we hit the bottom).
      let drawTopOffset = 0;
      if (step > 0) {
        // We expected the page to scroll by cssScrollStep CSS px between this
        // capture and the previous one. If actualY advanced less, the
        // difference is the overlap (in CSS px), which we convert to image px.
        const expectedAdvanceCss = cssScrollStep;
        const actualAdvanceCss = Math.max(0, actualY - prevActualY);
        const overlapCss = Math.max(0, expectedAdvanceCss - actualAdvanceCss);
        drawTopOffset = Math.round(overlapCss * effectiveDpr);
        // Defensive: never crop more than the image height
        drawTopOffset = Math.min(drawTopOffset, img.naturalHeight);
      }

      slices.push({ img, drawTopOffset });
      canvasH += img.naturalHeight - drawTopOffset;

      // Track scroll progression for the next iteration's overlap calc
      if (actualY === prevActualY) {
        stuckCount++;
        if (stuckCount >= 1) break; // page stopped scrolling
      } else {
        stuckCount = 0;
      }
      prevActualY = actualY;

      // Stop condition: we've reached the bottom of the page
      if (actualY + viewportHeight >= dims.scrollHeight - 1) break;

      await sleep(CAPTURE_DELAY_MS);
    }
  } finally {
    // Always restore page state
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

  // Stitch end-to-end: each slice starts where the previous one ended.
  const canvas = new OffscreenCanvas(canvasW, canvasH);
  const ctx = canvas.getContext('2d');

  let cursorY = 0;
  for (const { img, drawTopOffset } of slices) {
    const sliceVisibleH = img.naturalHeight - drawTopOffset;
    if (sliceVisibleH <= 0) continue;
    ctx.drawImage(
      img,
      0, drawTopOffset,                  // src x, y (skip overlapping top)
      img.naturalWidth, sliceVisibleH,   // src w, h
      0, cursorY,                        // dest x, y
      img.naturalWidth, sliceVisibleH    // dest w, h
    );
    cursorY += sliceVisibleH;
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

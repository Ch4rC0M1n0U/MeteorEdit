// Full-page screenshot via scroll + stitching.
// Works on both Chrome and Firefox (no debugger API required).
//
// Strategy:
//   1. Inject a content script that:
//      - Reads page dimensions (scrollHeight, devicePixelRatio)
//      - Hides position:fixed/sticky elements during capture (avoid duplicates)
//      - Disables CSS smooth-scroll (avoid animation lag)
//      - Returns metadata
//   2. Scroll the tab progressively, calling captureVisibleTab() at each step
//   3. Restore the page (scroll position, hidden styles)
//   4. Composite all PNG slices into one full-page canvas
//   5. Return the final dataURL (base64 PNG)
//
// Throttling:
//   chrome.tabs.captureVisibleTab() is rate-limited to ~2/sec on Chrome.
//   We wait ~600ms between captures to be safe.

const CAPTURE_DELAY_MS = 600;
const SCROLL_SETTLE_MS = 150;

/**
 * Capture the full scrollable page of a given tab.
 * @param {number} tabId
 * @param {(pct:number, label:string)=>void} onProgress
 * @returns {Promise<string>} base64 PNG data URL
 */
export async function captureFullPage(tabId, onProgress = () => {}) {
  onProgress(0.02, 'Préparation…');

  // Step 1: prepare the page (read dims, hide sticky, save state)
  const [{ result: prep }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const html = document.documentElement;
      const body = document.body;

      // Save the current state
      const saved = {
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        htmlScrollBehavior: html.style.scrollBehavior,
        bodyScrollBehavior: body.style.scrollBehavior,
      };

      // Disable smooth-scrolling (would break our step-by-step capture)
      html.style.scrollBehavior = 'auto';
      body.style.scrollBehavior = 'auto';

      // Hide position:fixed and sticky elements to avoid them being repeated
      // in every viewport slice. We tag them with a custom attribute so we
      // can restore them later.
      const stickies = [];
      const all = document.querySelectorAll('*');
      for (const el of all) {
        const cs = window.getComputedStyle(el);
        if (cs.position === 'fixed' || cs.position === 'sticky') {
          stickies.push({ el, prevVisibility: el.style.visibility });
          el.style.visibility = 'hidden';
        }
      }
      // Stash on a global so the cleanup script can find them again.
      window.__meteoreditStickyHidden = stickies;
      window.__meteoreditSavedScroll = saved;

      const dims = {
        // We use the max of html/body to be defensive on weird sites.
        scrollHeight: Math.max(
          html.scrollHeight, body.scrollHeight,
          html.offsetHeight, body.offsetHeight,
          html.clientHeight
        ),
        scrollWidth: Math.max(
          html.scrollWidth, body.scrollWidth,
          html.offsetWidth, body.offsetWidth,
          html.clientWidth
        ),
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        dpr: window.devicePixelRatio || 1,
      };
      return dims;
    },
  });

  const { scrollHeight, scrollWidth, viewportHeight, viewportWidth, dpr } = prep;
  const slices = [];
  let y = 0;
  let stepIndex = 0;
  const totalSteps = Math.max(1, Math.ceil(scrollHeight / viewportHeight));

  try {
    while (y < scrollHeight) {
      // Scroll to position y
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (yy) => window.scrollTo(0, yy),
        args: [y],
      });
      await sleep(SCROLL_SETTLE_MS);

      // Read the actual scroll position (the page may not have honored our request
      // exactly — last slice typically scrolls less than requested).
      const [{ result: actualY }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => window.scrollY,
      });

      // Capture
      onProgress(stepIndex / totalSteps, `Capture ${stepIndex + 1}/${totalSteps}…`);
      const dataUrl = await captureWithRetry(tabId);
      slices.push({ y: actualY, dataUrl });

      stepIndex++;
      y += viewportHeight;
      // Throttle to respect captureVisibleTab MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND
      await sleep(CAPTURE_DELAY_MS);
    }
  } finally {
    // Always restore the page (scroll, sticky visibility) even on error
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
    }).catch(() => { /* the tab may have navigated away */ });
  }

  onProgress(0.95, 'Assemblage…');

  // Stitch all slices into one canvas (CSS px × dpr).
  const canvas = new OffscreenCanvas(
    Math.round(scrollWidth * dpr),
    Math.round(scrollHeight * dpr)
  );
  const ctx = canvas.getContext('2d');
  for (const slice of slices) {
    const img = await loadImage(slice.dataUrl);
    ctx.drawImage(img, 0, Math.round(slice.y * dpr));
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
      // Pass undefined for windowId — uses the active window
      return await chrome.tabs.captureVisibleTab(undefined, { format: 'png' });
    } catch (err) {
      lastErr = err;
      // Rate-limit error → wait longer and retry
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
    // OffscreenCanvas in service workers cannot use `new Image()`. We are running
    // in the popup window which is a real DOM context, so Image is available.
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

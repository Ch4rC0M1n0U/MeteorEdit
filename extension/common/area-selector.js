// Injected as a content script. Exposes window.__meteoreditAreaSelect()
// which renders an overlay, lets the user draw a rectangle, and resolves
// with { x, y, w, h, dpr } in CSS pixels relative to the viewport.
// Returns { cancelled: true } if the user presses Escape or clicks outside.

(function () {
  if (window.__meteoreditAreaSelect) return; // idempotent

  window.__meteoreditAreaSelect = function () {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 2147483647;
        background: rgba(0,0,0,0.25); cursor: crosshair;
        user-select: none;
      `;
      const rect = document.createElement('div');
      rect.style.cssText = `
        position: absolute; border: 2px solid #6366f1;
        background: rgba(99,102,241,0.18); pointer-events: none;
      `;
      const hint = document.createElement('div');
      hint.style.cssText = `
        position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
        background: rgba(17,17,17,0.92); color: #fff;
        font: 13px ui-sans-serif, system-ui, sans-serif;
        padding: 8px 14px; border-radius: 8px; pointer-events: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;
      hint.textContent = 'Cliquez-glissez pour sélectionner. Échap pour annuler.';
      overlay.appendChild(hint);
      overlay.appendChild(rect);
      document.body.appendChild(overlay);

      let startX = 0, startY = 0, drawing = false;

      function cleanup() {
        try { overlay.remove(); } catch { /* ignore */ }
        document.removeEventListener('keydown', onKey, true);
      }

      function onKey(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          cleanup();
          resolve({ cancelled: true });
        }
      }
      document.addEventListener('keydown', onKey, true);

      overlay.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        drawing = true;
        startX = e.clientX;
        startY = e.clientY;
        rect.style.left = startX + 'px';
        rect.style.top = startY + 'px';
        rect.style.width = '0px';
        rect.style.height = '0px';
      });

      overlay.addEventListener('mousemove', (e) => {
        if (!drawing) return;
        const x = Math.min(startX, e.clientX);
        const y = Math.min(startY, e.clientY);
        const w = Math.abs(e.clientX - startX);
        const h = Math.abs(e.clientY - startY);
        rect.style.left = x + 'px';
        rect.style.top = y + 'px';
        rect.style.width = w + 'px';
        rect.style.height = h + 'px';
      });

      overlay.addEventListener('mouseup', (e) => {
        if (!drawing) return;
        drawing = false;
        const x = Math.min(startX, e.clientX);
        const y = Math.min(startY, e.clientY);
        const w = Math.abs(e.clientX - startX);
        const h = Math.abs(e.clientY - startY);
        cleanup();
        if (w < 8 || h < 8) {
          resolve({ cancelled: true });
          return;
        }
        resolve({
          x, y, w, h,
          dpr: window.devicePixelRatio || 1,
          cancelled: false,
        });
      });
    });
  };
})();

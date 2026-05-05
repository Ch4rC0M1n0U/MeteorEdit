/**
 * Lightweight browser detection for the Companion install flow.
 * Returns a normalized identifier and whether the browser supports the
 * MeteorEdit Companion extension (Chromium-based + Firefox).
 */

export type BrowserId = 'chrome' | 'edge' | 'brave' | 'opera' | 'firefox' | 'safari' | 'other';

export interface BrowserInfo {
  id: BrowserId;
  /** Human-readable label (e.g. "Google Chrome", "Mozilla Firefox") */
  label: string;
  /** Compatible with MeteorEdit Companion extension */
  supported: boolean;
  /** Engine family: "chromium", "gecko", "webkit", or "other" */
  engine: 'chromium' | 'gecko' | 'webkit' | 'other';
}

/**
 * Best-effort detection. Prefers navigator.userAgentData when available
 * (modern Chromium), falls back to userAgent string parsing.
 */
export function detectBrowser(): BrowserInfo {
  if (typeof navigator === 'undefined') {
    return { id: 'other', label: 'Inconnu', supported: false, engine: 'other' };
  }

  const ua = (navigator.userAgent ?? '').toLowerCase();
  const uaData = (navigator as unknown as { userAgentData?: { brands: Array<{ brand: string }> } }).userAgentData;

  // userAgentData: precise brand list on Chromium browsers
  if (uaData?.brands?.length) {
    const brands = uaData.brands.map((b) => b.brand.toLowerCase());
    if (brands.some((b) => b.includes('edge'))) {
      return { id: 'edge', label: 'Microsoft Edge', supported: true, engine: 'chromium' };
    }
    if (brands.some((b) => b.includes('opera') || b.includes('opr'))) {
      return { id: 'opera', label: 'Opera', supported: true, engine: 'chromium' };
    }
    if (brands.some((b) => b.includes('brave'))) {
      return { id: 'brave', label: 'Brave', supported: true, engine: 'chromium' };
    }
    if (brands.some((b) => b.includes('chrome'))) {
      return { id: 'chrome', label: 'Google Chrome', supported: true, engine: 'chromium' };
    }
  }

  // Firefox
  if (ua.includes('firefox')) {
    return { id: 'firefox', label: 'Mozilla Firefox', supported: true, engine: 'gecko' };
  }
  // Edge (legacy UA detection)
  if (ua.includes('edg/')) {
    return { id: 'edge', label: 'Microsoft Edge', supported: true, engine: 'chromium' };
  }
  // Brave
  if ((navigator as unknown as { brave?: unknown }).brave) {
    return { id: 'brave', label: 'Brave', supported: true, engine: 'chromium' };
  }
  // Opera
  if (ua.includes('opr/') || ua.includes('opera')) {
    return { id: 'opera', label: 'Opera', supported: true, engine: 'chromium' };
  }
  // Chrome (must be checked AFTER Edge/Opera/Brave since they all include "chrome" in UA)
  if (ua.includes('chrome') || ua.includes('chromium')) {
    return { id: 'chrome', label: 'Google Chrome', supported: true, engine: 'chromium' };
  }
  // Safari (webkit, no Companion extension support — MV3 differs significantly)
  if (ua.includes('safari')) {
    return { id: 'safari', label: 'Safari', supported: false, engine: 'webkit' };
  }

  return { id: 'other', label: 'Navigateur inconnu', supported: false, engine: 'other' };
}

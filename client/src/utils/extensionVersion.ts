/**
 * Version of the MeteorEdit Companion browser extension shipped from this repo.
 * Keep in sync with extension/manifest.json on every extension release.
 *
 * Single source of truth for the app code (banner, install page, etc.).
 * The promo banner uses this string to version its dismiss flag — bumping
 * the version automatically re-shows the banner once for every user.
 */
export const EXTENSION_VERSION = '2.0.3';

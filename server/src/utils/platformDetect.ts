import type { SocialPlatform } from '../models/SocialCookie';

const PATTERNS: Array<{ re: RegExp; platform: SocialPlatform }> = [
  { re: /(^|\.)instagram\.com$/i,                                  platform: 'instagram' },
  { re: /(^|\.)facebook\.com$/i,                                   platform: 'facebook' },
  { re: /(^|\.)threads\.(com|net)$/i,                              platform: 'threads' },
  { re: /(^|\.)(x|twitter)\.com$/i,                                platform: 'x' },
  { re: /(^|\.)tiktok\.com$/i,                                     platform: 'tiktok' },
  { re: /(^|\.)linkedin\.com$/i,                                   platform: 'linkedin' },
  { re: /(^|\.)(youtube\.com|youtu\.be)$/i,                        platform: 'youtube' },
  { re: /(^|\.)reddit\.com$/i,                                     platform: 'reddit' },
  { re: /(^|\.)snapchat\.com$/i,                                   platform: 'snapchat' },
  { re: /(^|\.)(t\.me|telegram\.(me|org))$/i,                      platform: 'telegram' },
  { re: /(^|\.)(whatsapp\.com|wa\.me|web\.whatsapp\.com)$/i,       platform: 'whatsapp' },
  { re: /(mastodon|mstdn|piaille\.fr|framapiaf\.org|mamot\.fr)/i,  platform: 'mastodon' },
  { re: /(^|\.)linktr\.ee$/i,                                      platform: 'linktree' },
  { re: /(^|\.)(paypal\.com|paypal\.me)$/i,                        platform: 'paypal' },
  { re: /(^|\.)strava\.com$/i,                                     platform: 'strava' },
];

export function detectPlatformFromUrl(url: string): SocialPlatform | null {
  try {
    const host = new URL(url).host;
    return PATTERNS.find((p) => p.re.test(host))?.platform ?? null;
  } catch {
    return null;
  }
}

import { whatsappService } from '../services/whatsappService';
import type { ProfileData } from './types';

/**
 * Extract a phone number in E.164 from a wa.me URL or arbitrary input.
 * Handles formats:
 *   https://wa.me/32474800127
 *   https://wa.me/+32474800127
 *   wa.me/32474800127
 *   tel:+32474800127
 *   raw "+32474800127"
 */
export function extractPhoneFromUrl(input: string): string | null {
  if (!input) return null;
  let raw = input.trim();
  // Pull the path/digits portion if URL
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    raw = u.pathname.replace(/^\/+/, '') || u.hostname;
  } catch {
    // not a URL — treat as raw input
  }
  // Keep + and digits only
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return null;
  return digits.startsWith('+') ? digits : `+${digits}`;
}

/**
 * Build a ProfileData from a WhatsApp profile fetched via the user's
 * WA Web session (whatsapp-web.js), so the rest of scrapeController can
 * render it like any other platform profile.
 *
 * Throws Error with explicit message if WA Web is not paired.
 */
export async function scrapeWhatsAppFromWeb(
  userId: string,
  url: string
): Promise<ProfileData> {
  const phoneE164 = extractPhoneFromUrl(url);
  if (!phoneE164) {
    throw new Error('Numéro de téléphone introuvable dans l\'URL');
  }

  // Make sure the WA session is ready (try to restore from stored auth)
  const ready = whatsappService.isReady(userId)
    ? true
    : await whatsappService.restoreSession(userId);
  if (!ready) {
    throw new Error(
      'Aucune session WhatsApp Web appairée. Allez dans Profile > Sessions sociales pour appairer votre compte avant de relancer l\'analyse.'
    );
  }

  const exists = await whatsappService.checkNumberExists(userId, phoneE164);
  if (!exists) {
    throw new Error(`Le numéro ${phoneE164} n'est pas enregistré sur WhatsApp.`);
  }

  const profile = await whatsappService.getProfile(userId, phoneE164);

  const username = phoneE164.replace(/^\+/, '');
  const hasAnyData = !!(profile?.name || profile?.about || profile?.avatarUrl);
  const displayName = profile?.name
    || (hasAnyData ? username : `${username} (compte WhatsApp actif — profil privé)`);

  return {
    platform: 'whatsapp',
    username,
    displayName,
    bio: profile?.about || (profile?.avatarUrl ? '' : 'Aucune information publique disponible. Le titulaire de ce numéro a probablement réglé sa confidentialité sur "Mes contacts" pour la photo de profil et le statut.'),
    profileImageUrl: profile?.avatarUrl || '',
    stats: {
      'Compte WhatsApp': 'actif',
      ...(profile?.isBusiness ? { Type: 'Business' } : {}),
    },
    registrationDate: null,
    extraImages: [],
    rawMetadata: {
      phoneE164,
      isBusiness: !!profile?.isBusiness,
      hasName: !!profile?.name,
      hasAvatar: !!profile?.avatarUrl,
      hasAbout: !!profile?.about,
      source: 'wa-web',
    },
  };
}

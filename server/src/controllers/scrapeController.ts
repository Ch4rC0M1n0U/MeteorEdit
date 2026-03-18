import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import SocialCookie from '../models/SocialCookie';
import SiteSettings from '../models/SiteSettings';
import DossierNode from '../models/DossierNode';
import Dossier from '../models/Dossier';
import { logActivity } from '../utils/activityLogger';
import { decryptCookies } from '../utils/cookieCrypto';
import { ProfileData } from '../scrapers/types';

const UPLOAD_DIR = path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || './uploads');
const PROFILES_DIR = path.join(UPLOAD_DIR, 'profiles');

import * as snapchatScraper from '../scrapers/snapchat';
import * as instagramScraper from '../scrapers/instagram';
import * as tiktokScraper from '../scrapers/tiktok';
import * as youtubeScraper from '../scrapers/youtube';
import * as facebookScraper from '../scrapers/facebook';
import * as xScraper from '../scrapers/x-twitter';
import * as whatsappScraper from '../scrapers/whatsapp';
import * as threadsScraper from '../scrapers/threads';
import * as linkedinScraper from '../scrapers/linkedin';
import * as linktreeScraper from '../scrapers/linktree';
import * as paypalScraper from '../scrapers/paypal';
import * as telegramScraper from '../scrapers/telegram';
import * as stravaScraper from '../scrapers/strava';

const CHROME_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const PLATFORM_PATTERNS: Array<{ pattern: RegExp; platform: string }> = [
  { pattern: /snapchat\.com/i, platform: 'snapchat' },
  { pattern: /instagram\.com/i, platform: 'instagram' },
  { pattern: /tiktok\.com/i, platform: 'tiktok' },
  { pattern: /(?:youtube\.com|youtu\.be)/i, platform: 'youtube' },
  { pattern: /facebook\.com/i, platform: 'facebook' },
  { pattern: /(?:x\.com|twitter\.com)/i, platform: 'x' },
  { pattern: /(?:wa\.me|whatsapp)/i, platform: 'whatsapp' },
  { pattern: /threads\.(?:com|net)/i, platform: 'threads' },
  { pattern: /linkedin\.com/i, platform: 'linkedin' },
  { pattern: /linktr\.ee/i, platform: 'linktree' },
  { pattern: /(?:paypal\.me|paypalme)/i, platform: 'paypal' },
  { pattern: /(?:t\.me|telegram\.me|telegram\.org)/i, platform: 'telegram' },
  { pattern: /strava\.com/i, platform: 'strava' },
];

const SCRAPERS: Record<string, { scrape: (page: any, url: string) => Promise<ProfileData> }> = {
  snapchat: snapchatScraper,
  instagram: instagramScraper,
  tiktok: tiktokScraper,
  youtube: youtubeScraper,
  facebook: facebookScraper,
  x: xScraper,
  whatsapp: whatsappScraper,
  threads: threadsScraper,
  linkedin: linkedinScraper,
  linktree: linktreeScraper,
  paypal: paypalScraper,
  telegram: telegramScraper,
  strava: stravaScraper,
};

const PLATFORM_EMOJIS: Record<string, string> = {
  snapchat: '\u{1F47B}',   // ghost
  instagram: '\u{1F4F7}',  // camera
  tiktok: '\u{1F3B5}',     // music note
  youtube: '\u{1F4FA}',    // TV
  facebook: '\u{1F465}',   // people
  x: '\u{1D54F}',          // X
  whatsapp: '\u{1F4AC}',   // speech bubble
  threads: '\u{1F9F5}',    // thread/spool
  linkedin: '\u{1F4BC}',   // briefcase
  linktree: '\u{1F332}',   // tree
  paypal: '\u{1F4B3}',     // credit card
  telegram: '\u{2708}',    // airplane (Telegram paper plane)
  strava: '\u{1F3C3}',     // runner
};

function detectPlatform(url: string): string | null {
  for (const { pattern, platform } of PLATFORM_PATTERNS) {
    if (pattern.test(url)) return platform;
  }
  return null;
}

async function checkDossierAccess(dossierId: string, userId: string): Promise<boolean> {
  const dossier = await Dossier.findById(dossierId);
  if (!dossier) return false;
  return dossier.owner.toString() === userId || dossier.collaborators.map((c: any) => c.toString()).includes(userId);
}

/**
 * Build a TipTap JSON document from scraped ProfileData.
 */
function buildTipTapContent(profile: ProfileData, platform: string, sourceUrl?: string): any {
  const now = new Date().toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const emoji = PLATFORM_EMOJIS[platform] || '\u{1F310}';
  const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);

  const content: any[] = [];

  // ── Heading: emoji + username + " — Profil" ──
  content.push({
    type: 'heading',
    attrs: { level: 2 },
    content: [{ type: 'text', text: `${emoji} ${profile.username} \u2014 Profil` }],
  });

  // ── Extraction info paragraph with source URL ──
  const extractionContent: any[] = [
    { type: 'text', text: `Extraction le ${now} depuis ${platformLabel}` },
  ];
  if (sourceUrl) {
    extractionContent.push(
      { type: 'text', text: ' — ' },
      { type: 'text', marks: [{ type: 'link', attrs: { href: sourceUrl, target: '_blank' } }], text: sourceUrl },
    );
  }
  content.push({ type: 'paragraph', content: extractionContent });

  // ── Profile image ──
  if (profile.profileImageUrl) {
    content.push({
      type: 'paragraph',
      content: [
        {
          type: 'image',
          attrs: { src: profile.profileImageUrl, alt: `Photo de profil de ${profile.username}` },
        },
      ],
    });
  }

  // ── Info table ──
  const rows: Array<[string, string]> = [];
  if (profile.displayName) rows.push(['Nom affiché', profile.displayName]);
  if (profile.bio) rows.push(['Bio', profile.bio]);

  // Platform-specific enriched fields from rawMetadata
  const meta = profile.rawMetadata || {};
  if (meta.location || meta.currentCity) rows.push(['Localisation', meta.location || meta.currentCity]);
  if (meta.country) rows.push(['Pays', meta.country]);
  if (meta.hometown) rows.push(["Ville d'origine", meta.hometown]);
  if (meta.jobTitle) rows.push(['Poste', meta.jobTitle]);
  if (meta.company) rows.push(['Entreprise', meta.company]);
  if (meta.industry) rows.push(['Secteur', meta.industry]);
  if (meta.website) rows.push(['Site web', meta.website]);
  if (meta.gender) rows.push(['Genre', meta.gender]);
  if (meta.relationshipStatus) rows.push(['Situation', meta.relationshipStatus]);
  if (meta.verified) rows.push(['Vérifié', 'Oui']);
  if (meta.identityVerified) rows.push(['Identité vérifiée', 'Oui (government ID)']);
  if (meta.verifications?.length > 0) rows.push(['Vérification', meta.verifications.join(', ')]);
  if (meta.memberSince) rows.push(['Membre depuis', meta.memberSince]);
  if (meta.isBlueVerified) rows.push(['Blue Verified', 'Oui']);
  if (meta.isPrivate) rows.push(['Compte privé', meta.isPrivate ? 'Oui' : 'Non']);
  if (meta.isBusiness) rows.push(['Compte pro', 'Oui']);
  if (meta.category) rows.push(['Catégorie', meta.category]);
  if (meta.userId) rows.push(['ID utilisateur', String(meta.userId)]);
  if (meta.instagramUserId) rows.push(['Instagram ID', String(meta.instagramUserId)]);
  if (meta.facebookId) rows.push(['Facebook ID', String(meta.facebookId)]);
  if (meta.externalUrl) rows.push(['Lien externe', meta.externalUrl]);
  if (meta.externalUrls?.length > 1) {
    for (let i = 1; i < meta.externalUrls.length; i++) {
      rows.push([`Lien externe ${i + 1}`, meta.externalUrls[i]]);
    }
  }
  if (meta.region) rows.push(['Région', meta.region]);
  if (meta.privateAccount) rows.push(['Compte privé', 'Oui']);
  if (meta.email) rows.push(['Email', meta.email]);
  if (meta.accountTier) rows.push(['Compte', meta.accountTier]);
  if (meta.googleAnalyticsId) rows.push(['Google Analytics', meta.googleAnalyticsId]);
  if (meta.facebookPixelId) rows.push(['Facebook Pixel', meta.facebookPixelId]);
  if (meta.tiktokPixelId) rows.push(['TikTok Pixel', meta.tiktokPixelId]);
  if (meta.donationsActive) rows.push(['Donations', 'Actives']);
  if (meta.services) rows.push(['Services', meta.services]);
  // Telegram-specific
  if (meta.telegramId) rows.push(['Telegram ID', meta.telegramId]);
  if (meta.accountType) rows.push(['Type de compte', meta.accountType]);
  if (meta.premium) rows.push(['Premium', 'Oui']);
  if (meta.isBot) rows.push(['Bot', 'Oui']);
  if (meta.scam) rows.push(['⚠ Scam', 'Oui']);
  if (meta.fake) rows.push(['⚠ Fake', 'Oui']);
  if (meta.lastSeen) rows.push(['Dernière connexion', meta.lastSeen]);
  if (meta.birthday) rows.push(['Anniversaire', String(meta.birthday)]);
  if (meta.paypalUrl) rows.push(['PayPal URL', meta.paypalUrl]);
  // Strava-specific
  if (meta.premium) rows.push(['Strava Premium', 'Oui']);
  if (meta.summit) rows.push(['Strava Summit', 'Oui']);
  if (meta.clubType) rows.push(['Type de club', meta.clubType]);
  if (meta.memberCount) rows.push(['Membres', meta.memberCount]);
  if (meta.activityTitle) rows.push(['Activité', meta.activityTitle]);
  if (meta.activityType) rows.push(['Type d\'activité', meta.activityType]);
  if (meta.activityDate) rows.push(['Date activité', meta.activityDate]);
  if (meta.kudos) rows.push(['Kudos', meta.kudos]);
  if (meta.commentsCount) rows.push(['Commentaires', meta.commentsCount]);
  if (meta.activityRange) rows.push(['Période d\'activité', meta.activityRange]);
  if (meta.activeYears?.length > 0) rows.push(['Années actives', meta.activeYears.join(', ')]);
  if (meta.socialLinks?.length > 0) {
    for (const sl of meta.socialLinks) {
      const type = (sl.type || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      rows.push([type || 'Réseau social', sl.url]);
    }
  }

  // Stats
  const STATS_LABELS: Record<string, string> = {
    followers: 'Abonnés',
    following: 'Abonnements',
    friends: 'Amis',
    posts: 'Publications',
    tweets: 'Tweets',
    likes: 'Likes',
    listed: 'Listé dans',
    mediaCount: 'Médias',
    subscribers: 'Abonnés',
    snapScore: 'Snap Score',
    storySnaps: 'Story snaps',
    spotlightHighlights: 'Spotlight',
    lenses: 'Lenses',
    curatedHighlights: 'Highlights',
    links: 'Liens',
    threads: 'Threads',
    replies: 'Réponses',
    diggCount: 'Vidéos aimées',
    totalViews: 'Vues totales',
    videos: 'Vidéos',
    connections: 'Connexions',
    employees: 'Employés',
    status: 'Statut',
    commonChats: 'Groupes en commun',
    activities: 'Activités',
    mutualFriends: 'Amis en commun',
    members: 'Membres',
  };
  for (const [key, value] of Object.entries(profile.stats)) {
    const label = STATS_LABELS[key] || key;
    rows.push([label, String(value)]);
  }

  if (profile.registrationDate) {
    rows.push(["Date d'inscription", String(profile.registrationDate)]);
  }

  if (meta.lastUpdated) {
    rows.push(['Dernière mise à jour', String(meta.lastUpdated)]);
  }

  if (rows.length > 0) {
    const tableRows = rows.map(([label, value]) => ({
      type: 'tableRow',
      content: [
        {
          type: 'tableCell',
          attrs: { colspan: 1, rowspan: 1, colwidth: null },
          content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: label }] }],
        },
        {
          type: 'tableCell',
          attrs: { colspan: 1, rowspan: 1, colwidth: null },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }],
        },
      ],
    }));

    content.push({ type: 'table', content: tableRows });
  }

  // ── Intro / About section ──
  const introItems = meta.introCardItems || meta.introItems;
  if (introItems && Array.isArray(introItems) && introItems.length > 0) {
    content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Informations' }],
    });

    const bulletItems = introItems.map((item: any) => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: typeof item === 'string' ? item : item.label || item.text || '' }] }],
    }));
    content.push({ type: 'bulletList', content: bulletItems });
  }

  // ── Linktree links section ──
  if (meta.links && Array.isArray(meta.links) && meta.links.length > 0) {
    content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Liens' }],
    });

    const linkItems = meta.links.map((link: any) => {
      const title = link.title || 'Sans titre';
      const url = link.url || '';
      const text = url ? `${title} — ${url}` : title;
      return {
        type: 'listItem',
        content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
      };
    });
    content.push({ type: 'bulletList', content: linkItems });
  }

  // ── Summary / About ──
  if (meta.summary) {
    content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'À propos' }],
    });
    content.push({
      type: 'paragraph',
      content: [{ type: 'text', text: meta.summary }],
    });
  }

  // ── Bio links ──
  if (meta.bioLinks && Array.isArray(meta.bioLinks) && meta.bioLinks.length > 0) {
    content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Liens' }],
    });
    const linkItems = meta.bioLinks.map((link: any) => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: `${link.title || ''} ${link.url || ''}`.trim() }] }],
    }));
    content.push({ type: 'bulletList', content: linkItems });
  }

  // ── Bio URLs (X/Twitter expanded URLs) ──
  if (meta.bioUrls && Array.isArray(meta.bioUrls) && meta.bioUrls.length > 0) {
    content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Liens dans la bio' }],
    });
    const urlItems = meta.bioUrls.map((u: any) => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: u.expanded || u.display || '' }] }],
    }));
    content.push({ type: 'bulletList', content: urlItems });
  }

  // ── Experience (LinkedIn) ──
  if (meta.experience && Array.isArray(meta.experience) && meta.experience.length > 0) {
    content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Expérience' }],
    });
    const expItems = meta.experience.map((exp: any) => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: `${exp.title}${exp.company ? ' @ ' + exp.company : ''}${exp.start ? ' (' + exp.start + ' - ' + (exp.end || 'Présent') + ')' : ''}` }] }],
    }));
    content.push({ type: 'bulletList', content: expItems });
  }

  // ── Education ──
  if (meta.education && Array.isArray(meta.education) && meta.education.length > 0) {
    content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Formation' }],
    });
    const eduItems = meta.education.map((edu: any) => {
      const text = typeof edu === 'string' ? edu : `${edu.school || ''}${edu.degree ? ' — ' + edu.degree : ''}${edu.field ? ' (' + edu.field + ')' : ''}`;
      return {
        type: 'listItem',
        content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
      };
    });
    content.push({ type: 'bulletList', content: eduItems });
  }

  // ── Recent Activities (Strava) ──
  if (meta.recentActivities && Array.isArray(meta.recentActivities) && meta.recentActivities.length > 0) {
    content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Activités récentes' }],
    });
    const actItems = meta.recentActivities.map((act: any) => {
      const parts = [act.title || 'Activité', act.type ? `(${act.type})` : '', act.time || '', act.stats || ''].filter(Boolean);
      const textContent: any[] = [{ type: 'text', text: parts.join(' — ') }];
      if (act.link) {
        textContent.push(
          { type: 'text', text: ' ' },
          { type: 'text', marks: [{ type: 'link', attrs: { href: act.link, target: '_blank' } }], text: '[lien]' },
        );
      }
      return {
        type: 'listItem',
        content: [{ type: 'paragraph', content: textContent }],
      };
    });
    content.push({ type: 'bulletList', content: actItems });
  }

  // ── Clubs (Strava) ──
  if (meta.clubs && Array.isArray(meta.clubs) && meta.clubs.length > 0) {
    content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Clubs' }],
    });
    const clubItems = meta.clubs.map((club: any) => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: typeof club === 'string' ? club : club.name || '' }] }],
    }));
    content.push({ type: 'bulletList', content: clubItems });
  }

  // ── Segments (Strava activity) ──
  if (meta.segments && Array.isArray(meta.segments) && meta.segments.length > 0) {
    content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Segments' }],
    });
    const segItems = meta.segments.map((seg: any) => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: `${seg.name}${seg.time ? ' — ' + seg.time : ''}` }] }],
    }));
    content.push({ type: 'bulletList', content: segItems });
  }

  // ── Members (Strava club) ──
  if (meta.members && Array.isArray(meta.members) && meta.members.length > 0) {
    content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Membres' }],
    });
    const memberItems = meta.members.map((m: any) => {
      const textContent: any[] = [{ type: 'text', text: m.name || 'Athlète' }];
      if (m.profileUrl) {
        textContent.push(
          { type: 'text', text: ' — ' },
          { type: 'text', marks: [{ type: 'link', attrs: { href: m.profileUrl, target: '_blank' } }], text: m.profileUrl },
        );
      }
      return {
        type: 'listItem',
        content: [{ type: 'paragraph', content: textContent }],
      };
    });
    content.push({ type: 'bulletList', content: memberItems });
  }

  // ── Trophies (Strava) ──
  if (meta.trophies && Array.isArray(meta.trophies) && meta.trophies.length > 0) {
    content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Trophées / Badges' }],
    });
    const trophyItems = meta.trophies.map((t: any) => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: typeof t === 'string' ? t : t.name || '' }] }],
    }));
    content.push({ type: 'bulletList', content: trophyItems });
  }

  // ── Extra images ──
  if (profile.extraImages.length > 0) {
    content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Images' }],
    });

    for (const imgUrl of profile.extraImages) {
      content.push({
        type: 'paragraph',
        content: [
          {
            type: 'image',
            attrs: { src: imgUrl, alt: 'Image extraite' },
          },
        ],
      });
    }
  }

  // ── Screenshot (WhatsApp) ──
  if (meta.screenshotPath) {
    content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Capture d\'écran' }],
    });
    // screenshotPath will be resolved to full URL in scrapeProfile() after serverUrl is known
    content.push({
      type: 'paragraph',
      content: [
        {
          type: 'image',
          attrs: { src: `__SCREENSHOT_PLACEHOLDER__`, alt: 'Capture wa.me' },
        },
      ],
    });
  }

  // ── Raw metadata as code block ──
  // Filter out bulky internal data already displayed above
  const displayMeta = { ...profile.rawMetadata };
  delete displayMeta.nextData;
  delete displayMeta.universalData;
  delete displayMeta.ytInitialData;
  delete displayMeta.graphqlUser;
  delete displayMeta.sharedData;
  delete displayMeta.apiData;
  delete displayMeta.apiUser;
  delete displayMeta.apiProfile;
  delete displayMeta.profileHeaderQuery;
  delete displayMeta.jsonLd;
  delete displayMeta.story;
  // Also remove fields already in the table
  delete displayMeta.introCardItems;
  delete displayMeta.introItems;
  delete displayMeta.summary;
  delete displayMeta.bioLinks;
  delete displayMeta.bioUrls;
  delete displayMeta.experience;
  delete displayMeta.education;
  delete displayMeta.screenshotPath;
  delete displayMeta.pageAnalysis;
  delete displayMeta.recentActivities;
  delete displayMeta.clubs;
  delete displayMeta.segments;
  delete displayMeta.members;
  delete displayMeta.trophies;
  delete displayMeta.apiAthlete;
  delete displayMeta.apiActivity;
  delete displayMeta.apiClub;
  delete displayMeta.serverData;
  delete displayMeta.trainingLog;
  delete displayMeta.activeYears;
  delete displayMeta.trainingTotals;

  content.push({
    type: 'heading',
    attrs: { level: 3 },
    content: [{ type: 'text', text: 'Métadonnées brutes' }],
  });

  content.push({
    type: 'codeBlock',
    attrs: { language: 'json' },
    content: [{ type: 'text', text: JSON.stringify(displayMeta, null, 2) }],
  });

  return { type: 'doc', content };
}

/**
 * Download an image from a URL using the Puppeteer page context (which has cookies/auth).
 * Returns the local path relative to uploads dir, or null on failure.
 */
async function downloadImage(page: any, imageUrl: string, prefix: string): Promise<string | null> {
  if (!imageUrl || !imageUrl.startsWith('http')) {
    console.log(`[ScrapeProfile] downloadImage skipped: invalid URL "${imageUrl?.substring(0, 80)}"`);
    return null;
  }

  try {
    // Ensure profiles directory exists
    if (!fs.existsSync(PROFILES_DIR)) {
      fs.mkdirSync(PROFILES_DIR, { recursive: true });
    }

    console.log(`[ScrapeProfile] Downloading image: ${imageUrl.substring(0, 120)}...`);

    // Strategy 1: Download via Puppeteer page.evaluate fetch (has cookies, same origin)
    let imageData = await page.evaluate(async (url: string) => {
      try {
        const resp = await fetch(url, { credentials: 'include', redirect: 'follow' });
        if (!resp.ok) return { error: `HTTP ${resp.status}`, size: 0 };
        const buffer = await resp.arrayBuffer();
        const contentType = resp.headers.get('content-type') || '';
        // Convert to base64
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return { base64: btoa(binary), contentType, size: buffer.byteLength };
      } catch (e: any) { return { error: e.message || 'fetch failed', size: 0 }; }
    }, imageUrl);

    // Strategy 2: If page.evaluate fetch failed, try with a new page (different origin)
    if (!imageData || imageData.error || !imageData.base64 || imageData.size < 100) {
      console.log(`[ScrapeProfile] Page fetch failed (${imageData?.error || 'empty'}), trying direct page navigation...`);
      try {
        const browser = page.browser();
        const imgPage = await browser.newPage();
        const response = await imgPage.goto(imageUrl, { waitUntil: 'load', timeout: 15000 });
        if (response && response.ok()) {
          const buffer = await response.buffer();
          const contentType = response.headers()['content-type'] || '';
          if (buffer && buffer.length > 100) {
            imageData = { base64: buffer.toString('base64'), contentType, size: buffer.length };
            console.log(`[ScrapeProfile] Direct navigation download succeeded: ${buffer.length} bytes`);
          }
        }
        await imgPage.close();
      } catch (e: any) {
        console.warn(`[ScrapeProfile] Direct navigation also failed: ${e.message}`);
      }
    }

    if (!imageData || imageData.error) {
      console.warn(`[ScrapeProfile] Image download failed: ${imageData?.error || 'no data'}`);
      return null;
    }

    if (!imageData.base64 || imageData.size < 100) {
      console.warn(`[ScrapeProfile] Image too small or empty: ${imageData.size} bytes`);
      return null;
    }

    // Determine extension from content-type
    let ext = '.jpg';
    if (imageData.contentType.includes('png')) ext = '.png';
    else if (imageData.contentType.includes('webp')) ext = '.webp';
    else if (imageData.contentType.includes('gif')) ext = '.gif';

    const filename = `${prefix}-${uuidv4().slice(0, 8)}${ext}`;
    const filePath = path.join(PROFILES_DIR, filename);

    // Write file
    const buffer = Buffer.from(imageData.base64, 'base64');
    fs.writeFileSync(filePath, buffer);

    console.log(`[ScrapeProfile] Image saved: ${filename} (${imageData.size} bytes, ${imageData.contentType})`);
    return `uploads/profiles/${filename}`;
  } catch (err) {
    console.warn(`[ScrapeProfile] Failed to download image: ${imageUrl.substring(0, 120)}`, err);
    return null;
  }
}

/**
 * Download profile image and extra images, replacing URLs with local paths.
 */
async function downloadProfileImages(page: any, profile: ProfileData, serverUrl: string): Promise<void> {
  console.log(`[ScrapeProfile] downloadProfileImages: profileImageUrl="${profile.profileImageUrl?.substring(0, 100)}", extraImages=${profile.extraImages.length}`);

  // Download main profile image
  if (profile.profileImageUrl) {
    const localPath = await downloadImage(page, profile.profileImageUrl, 'profile');
    if (localPath) {
      profile.rawMetadata.originalProfileImageUrl = profile.profileImageUrl;
      profile.profileImageUrl = `${serverUrl}/${localPath}`;
      console.log(`[ScrapeProfile] Profile image saved as: ${profile.profileImageUrl}`);
    } else {
      console.warn(`[ScrapeProfile] Failed to download profile image, keeping original URL`);
    }
  } else {
    console.warn(`[ScrapeProfile] No profile image URL to download`);
  }

  // Download extra images (cover photos, etc.) — limit to first 3 to avoid slowdown
  const downloadedExtras: string[] = [];
  for (let i = 0; i < Math.min(profile.extraImages.length, 3); i++) {
    const imgUrl = profile.extraImages[i];
    if (imgUrl && imgUrl.startsWith('http')) {
      const localPath = await downloadImage(page, imgUrl, 'extra');
      if (localPath) {
        profile.rawMetadata[`originalExtraImage_${i}`] = imgUrl;
        downloadedExtras.push(`${serverUrl}/${localPath}`);
      } else {
        downloadedExtras.push(imgUrl); // Keep original URL as fallback
      }
    } else {
      downloadedExtras.push(imgUrl);
    }
  }
  profile.extraImages = downloadedExtras;
}

/**
 * Scrape a social media profile and create a note node.
 * POST /api/social/scrape-profile
 * Body: { url, dossierId, parentId? }
 */
export async function scrapeProfile(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { url, dossierId, parentId } = req.body;
  const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
  const ua = req.headers['user-agent'] || '';

  let browser;

  try {
    // ── Validate input ──
    if (!url || !dossierId) {
      res.status(400).json({ message: 'url et dossierId requis' });
      return;
    }

    // ── Check dossier access ──
    if (!(await checkDossierAccess(dossierId, userId))) {
      res.status(403).json({ message: 'Accès refusé au dossier' });
      return;
    }

    // ── Detect platform ──
    const platform = detectPlatform(url);
    if (!platform) {
      res.status(400).json({ message: 'URL non reconnue. Plateformes supportées : Snapchat, Instagram, TikTok, YouTube, Facebook, X/Twitter, WhatsApp, Threads, LinkedIn, PayPal, Telegram.' });
      return;
    }

    const scraper = SCRAPERS[platform];
    if (!scraper) {
      res.status(400).json({ message: `Scraper non disponible pour la plateforme : ${platform}` });
      return;
    }

    // ── Check enabled platforms ──
    const settings = await SiteSettings.findOne();
    const enabledPlatforms = settings?.osint?.enabledPlatforms || [];
    if (!enabledPlatforms.includes(platform)) {
      res.status(403).json({ message: `La plateforme "${platform}" n'est pas activée.` });
      return;
    }

    // ── Load encrypted cookies ──
    let cookies: any[] = [];
    const cookieRecord = await SocialCookie.findOne({ userId, platform });
    if (cookieRecord) {
      try {
        cookies = decryptCookies(cookieRecord.cookies) as any[];
      } catch (err) {
        console.warn(`[ScrapeProfile] Failed to decrypt cookies for ${platform}:`, err);
      }
    }

    // ── Launch Puppeteer with stealth settings ──
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        `--user-agent=${CHROME_USER_AGENT}`,
      ],
      defaultViewport: { width: 1920, height: 1080 },
    });

    const page = await browser.newPage();
    await page.setUserAgent(CHROME_USER_AGENT);

    // Mask webdriver detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      // @ts-ignore
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en-US', 'en'] });
    });

    // ── Set cookies if available ──
    if (cookies.length > 0) {
      // Normalize cookies: CDP format may have extra fields that page.setCookie rejects
      const normalizedCookies = cookies.map((c: any) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path || '/',
        expires: c.expires && c.expires > 0 ? c.expires : undefined,
        httpOnly: c.httpOnly ?? false,
        secure: c.secure ?? false,
        sameSite: c.sameSite === 'None' ? 'None' as const
          : c.sameSite === 'Lax' ? 'Lax' as const
          : c.sameSite === 'Strict' ? 'Strict' as const
          : undefined,
      })).filter((c: any) => c.name && c.value && c.domain);

      try {
        await page.setCookie(...normalizedCookies);
        console.log(`[ScrapeProfile] Set ${normalizedCookies.length} cookies for ${platform}`);
      } catch (err) {
        console.warn(`[ScrapeProfile] Error setting cookies for ${platform}:`, err);
        // Try setting cookies one by one to skip problematic ones
        for (const cookie of normalizedCookies) {
          try { await page.setCookie(cookie); } catch { }
        }
      }
    }

    // ── Run scraper ──
    console.log(`[ScrapeProfile] Running ${platform} scraper for ${url}`);
    // Pass telegramConfig for Telegram scraper if available in settings
    let profileData: ProfileData;
    if (platform === 'telegram' && settings?.osint) {
      const tgConfig = (settings.osint as any).telegramConfig;
      profileData = await (scraper as any).scrape(page, url, tgConfig || undefined);
    } else {
      profileData = await scraper.scrape(page, url);
    }
    console.log(`[ScrapeProfile] ${platform} scraper done: username=${profileData.username}, displayName=${profileData.displayName}, profilePic=${!!profileData.profileImageUrl}, stats=${JSON.stringify(profileData.stats)}`);

    // ── Download profile images locally before closing browser ──
    // This is critical because platforms like Instagram/Facebook use expiring image URLs
    const serverUrl = `${req.protocol}://${req.get('host')}`;
    await downloadProfileImages(page, profileData, serverUrl);

    // ── Close browser ──
    await browser.close();
    browser = undefined;

    // ── Build TipTap content ──
    const tiptapContent = buildTipTapContent(profileData, platform, url);

    // Replace screenshot placeholder with actual URL
    if (profileData.rawMetadata?.screenshotPath) {
      const screenshotUrl = `${serverUrl}/${profileData.rawMetadata.screenshotPath}`;
      const contentStr = JSON.stringify(tiptapContent);
      const replaced = contentStr.replace('__SCREENSHOT_PLACEHOLDER__', screenshotUrl);
      Object.assign(tiptapContent, JSON.parse(replaced));
    }

    // ── Create DossierNode ──
    const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);
    const nodeTitle = `${profileData.displayName || profileData.username} — Profil ${platformLabel}`;

    const node = await DossierNode.create({
      dossierId,
      parentId: parentId || null,
      type: 'note',
      title: nodeTitle,
      content: tiptapContent,
    });

    // ── Log activity ──
    await logActivity(userId, 'social.scrape', 'node', node._id.toString(), {
      dossierId,
      platform,
      url,
      username: profileData.username,
    }, ip, ua);

    res.json({
      message: 'Profil extrait avec succès',
      node: {
        _id: node._id,
        dossierId: node.dossierId,
        parentId: node.parentId,
        type: node.type,
        title: node.title,
        content: node.content,
        createdAt: (node as any).createdAt,
      },
      profile: {
        platform: profileData.platform,
        username: profileData.username,
        displayName: profileData.displayName,
        stats: profileData.stats,
      },
    });
  } catch (err: any) {
    console.error('[ScrapeProfile] Error:', err?.message || err);
    if (browser) await browser.close().catch(() => {});

    res.status(500).json({
      message: "Erreur lors de l'extraction du profil",
      error: err?.message || 'Erreur inconnue',
    });
  }
}

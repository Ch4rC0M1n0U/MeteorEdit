import express from 'express';
import { createServer } from 'http';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';

const execFileAsync = promisify(execFile);
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { authLimiter, refreshLimiter, apiLimiter, heavyLimiter } from './middleware/rateLimit';
import { connectDB } from './config/database';
import { setupSocket, getIO } from './socket';
import { phoneScannerQueue } from './services/phoneScannerQueue';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import dossierRoutes from './routes/dossiers';
import nodeRoutes from './routes/nodes';
import searchRoutes from './routes/search';
import exportRoutes from './routes/export';
import snapshotRoutes from './routes/snapshots';
import settingsRoutes from './routes/settings';
import notificationRoutes from './routes/notifications';
import templateRoutes from './routes/templates';
import aiRoutes from './routes/ai';
import reportTemplateRoutes from './routes/reportTemplates';
import taskRoutes from './routes/tasks';
import clipperRoutes from './routes/clipper';
import mediaRoutes from './routes/media';
import socialRoutes from './routes/social';
import encryptionRoutes from './routes/encryption';
import languagetoolRoutes from './routes/languagetool';
import changelogRoutes from './routes/changelog';
import osintSearchRoutes from './routes/osintSearch';
import setupRoutes from './routes/setup';
import apiKeyRoutes from './routes/apiKeys';
import webcheckRoutes from './routes/webcheck';
import telegramRoutes from './routes/telegram';
import shodanRoutes from './routes/shodan';
import onypheRoutes from './routes/onyphe';
import phoneScannerRoutes from './routes/phoneScanner';
import apiTokenRoutes from './routes/apiTokens';
import extensionRoutes from './routes/extension';
import SiteSettings from './models/SiteSettings';
import User from './models/User';
import { startYjsServer } from './yjs-server';
import { checkMaintenance, loadMaintenanceState } from './middleware/maintenance';
import { startTrashPurgeJob } from './jobs/trashPurge';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// Trust proxy headers (X-Forwarded-Proto, X-Forwarded-Host) from nginx
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:', '*'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      fontSrc: ["'self'", 'https:', 'data:'],
      connectSrc: ["'self'", '*'],
    },
  },
}));
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : undefined;

app.use(cors({
  origin: (origin, callback) => {
    // Allow no-origin (curl, server-to-server) and any chrome-extension://*
    if (!origin) return callback(null, true);
    if (origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://')) {
      return callback(null, true);
    }
    if (!allowedOrigins || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  optionsSuccessStatus: 200,
}));
app.use(compression());
app.use(express.json({ limit: '100mb' }));

// Branding files - public (logos, favicons, login backgrounds)
app.use('/uploads/branding', express.static(path.join(__dirname, '..', process.env.UPLOAD_DIR || './uploads', 'branding')));
// All other uploads: served with .enc fallback (sensitive files are E2E encrypted — the encryption IS the security layer)
import { serveUploadFile } from './controllers/fileController';
app.get('/uploads/*filepath', serveUploadFile);

// Swagger API documentation (protected in production)
const swaggerAuth = (req: any, res: any, next: any) => {
  if (process.env.NODE_ENV === 'development') return next();
  const token = req.headers.authorization?.split(' ')[1] || req.query.token;
  if (!token) {
    res.status(401).json({ error: 'Authentication required to view API docs' });
    return;
  }
  try {
    jwt.verify(token, process.env.JWT_SECRET!);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
app.use('/api-docs', swaggerAuth, swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'MeteorEdit API Documentation',
}));
app.get('/api-docs.json', swaggerAuth, (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Rate limiting (must be before routes)
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/refresh', refreshLimiter);
app.use('/api/ai', heavyLimiter);
app.use('/api/clip', heavyLimiter);
app.use('/api/export', heavyLimiter);
app.use('/api/media/analyze', heavyLimiter);
// OSINT search: no rate limit (SearxNG handles its own throttling)
app.use('/api', apiLimiter);

app.use('/api/setup', setupRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api', checkMaintenance);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dossiers', dossierRoutes);
app.use('/api', nodeRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/report-templates', reportTemplateRoutes);
app.use('/api', exportRoutes);
app.use('/api', snapshotRoutes);
app.use('/api', taskRoutes);
app.use('/api/clip', clipperRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/encryption', encryptionRoutes);
app.use('/api/languagetool', languagetoolRoutes);
app.use('/api/changelog', changelogRoutes);
app.use('/api/osint', osintSearchRoutes);
app.use('/api/api-keys', apiKeyRoutes);
app.use('/api', webcheckRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/shodan', shodanRoutes);
app.use('/api/onyphe', onypheRoutes);
app.use('/api/phone-scanner', phoneScannerRoutes);
app.use('/api/auth/api-tokens', apiTokenRoutes);
app.use('/api/extension', extensionRoutes);

setupSocket(httpServer);

// Wire Socket.io into the Phone Scanner queue for live progress events
const io = getIO();
if (io) phoneScannerQueue.setSocketServer(io);

// Don't crash the server on unhandled rejections from whatsapp-web.js / Puppeteer
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[server] uncaughtException:', err);
});

async function detectOsintTools() {
  try {
    const settings = await SiteSettings.findOne();
    if (!settings) return;

    const ytdlpPath = settings.osint?.ytdlpPath || 'yt-dlp';
    const ffmpegPath = settings.osint?.ffmpegPath || 'ffmpeg';

    let ytdlpVersion = '';
    let ffmpegVersion = '';

    try {
      const { stdout } = await execFileAsync(ytdlpPath, ['--version']);
      ytdlpVersion = stdout.trim();
      console.log(`[OSINT] yt-dlp detected: v${ytdlpVersion}`);
    } catch {
      console.warn('[OSINT] yt-dlp not found or not executable');
    }

    try {
      const { stdout } = await execFileAsync(ffmpegPath, ['-version']);
      const firstLine = stdout.split('\n')[0] || '';
      const match = firstLine.match(/ffmpeg version (\S+)/);
      ffmpegVersion = match ? match[1] : firstLine.trim();
      console.log(`[OSINT] ffmpeg detected: v${ffmpegVersion}`);
    } catch {
      console.warn('[OSINT] ffmpeg not found or not executable');
    }

    await SiteSettings.updateOne({}, {
      $set: {
        'osint.ytdlpVersion': ytdlpVersion,
        'osint.ffmpegVersion': ffmpegVersion,
      },
    });
  } catch (err) {
    console.error('[OSINT] Error detecting tools:', err);
  }
}

async function seedDefaultAdmin() {
  const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
  if (adminCount > 0) return;

  const existingUser = await User.findOne({ email: 'admin@meteoredit.local' });
  if (existingUser) return;

  await User.create({
    email: 'admin@meteoredit.local',
    password: 'Admin123!',
    firstName: 'Admin',
    lastName: 'MeteorEdit',
    role: 'admin',
    isActive: true,
  });
  console.log('[SEED] Default admin created: admin@meteoredit.local / Admin123!');
}

async function seedChangelog() {
  const Changelog = (await import('./models/Changelog')).default;
  const versions = [
    {
      version: '3.2.0-beta.1',
      entries: [
        { type: 'feature', message: 'Dates & référence dossier (arrivée, attribution, clôture, n° de référence)' },
        { type: 'feature', message: 'Alertes de durée par classification (routine, prioritaire, urgent)' },
        { type: 'feature', message: 'Mode "Dossier en continu" (désactive les alertes de durée)' },
        { type: 'feature', message: 'Onglets Favoris / En cours / Clôturés sur la page d\'accueil' },
        { type: 'feature', message: 'Statistiques temps de traitement avec graphiques' },
        { type: 'feature', message: 'Cookie Bridge extension pour export de cookies' },
        { type: 'feature', message: 'HTTPS self-signed pour Web Crypto API' },
        { type: 'fix', message: 'Téléchargement YouTube via yt-dlp avec impersonation TLS' },
        { type: 'fix', message: 'Capture d\'écran web clipper avec qualité améliorée' },
        { type: 'improvement', message: 'Cartes compactes pour les dossiers clôturés' },
        { type: 'improvement', message: 'Configuration admin des seuils d\'alerte' },
      ],
    },
    {
      version: '3.2.1-beta.1',
      entries: [
        { type: 'feature', message: 'What\'s New : journal des nouveautés avec badge compteur' },
        { type: 'feature', message: 'Détection auto MP4 audio-only → bascule vers waveform' },
        { type: 'fix', message: 'Temps de traitement calculé depuis la date d\'attribution' },
        { type: 'fix', message: 'Partage de dossier chiffré E2E avec collaborateurs' },
        { type: 'fix', message: 'Layout Dates/Référence/Tags en pleine largeur (grille 4 colonnes)' },
        { type: 'improvement', message: 'Tags affichés en chips au lieu d\'un champ de texte' },
        { type: 'improvement', message: 'Menu admin simplifié (alertes durée intégrées dans Dossiers)' },
        { type: 'improvement', message: 'Couleurs de statut cohérentes (vert/bleu/rouge)' },
      ],
    },
    {
      version: '3.3.0-beta.1',
      entries: [
        { type: 'feature', message: 'Statistiques temps de traitement avec graphique à barres dans le dashboard' },
        { type: 'feature', message: 'Onglets Favoris / En cours / Clôturés sur la page d\'accueil' },
        { type: 'feature', message: 'Badge "En continu" (violet) pour les dossiers longue durée' },
        { type: 'feature', message: 'Cartes compactes pour les dossiers clôturés' },
        { type: 'fix', message: 'N° de référence déplacé dans la section Classification' },
        { type: 'fix', message: 'Sidebar admin scrollable et menu réorganisé' },
        { type: 'fix', message: 'Sauvegarde des alertes de durée dans l\'admin' },
        { type: 'improvement', message: 'Info dossier : toutes les sections en pleine largeur (grilles 3/4/5 colonnes)' },
        { type: 'improvement', message: 'Enquêteur et classification en grille 4-5 colonnes' },
      ],
    },
    {
      version: '3.7.0',
      entries: [
        { type: 'feature', message: 'Migration compl\u00e8te Vuetify \u2192 PrimeVue 4 (72 composants)' },
        { type: 'feature', message: 'Nouveau sidebar avec navigation am\u00e9lior\u00e9e et bouton retour dossier' },
        { type: 'fix', message: 'Traductions i18n manquantes (nav.profile, nav.main, nav.tools)' },
        { type: 'fix', message: 'Contenu des mod\u00e8les affich\u00e9 correctement dans la modal d\'\u00e9dition' },
        { type: 'improvement', message: 'Dashboard simplifi\u00e9 : suppression section Types d\'\u00e9l\u00e9ments' },
        { type: 'improvement', message: 'Cards dossiers cl\u00f4tur\u00e9s all\u00e9g\u00e9es (r\u00e9f\u00e9rence retir\u00e9e)' },
        { type: 'improvement', message: 'Recherche OSINT retir\u00e9e du menu principal' },
      ],
    },
    {
      version: '3.11.0',
      entries: [
        { type: 'feature', message: 'Ic\u00f4nes de r\u00e9seaux sociaux @iconify/vue : vraies ic\u00f4nes de marque via composant centralis\u00e9 SocialIcon (Facebook, Instagram, Snapchat, LinkedIn, TikTok, etc.)' },
        { type: 'feature', message: 'Nouvel onglet Custom dans le panneau Entit\u00e9s Excalidraw pour cr\u00e9er des entit\u00e9s personnalis\u00e9es avec s\u00e9lection de type et libell\u00e9 libre' },
        { type: 'feature', message: 'Carte d\'identit\u00e9 enrichie sur Excalidraw : avatar mieux positionn\u00e9, police Arial coh\u00e9rente, texte agrandi et lisible' },
        { type: 'feature', message: 'Vignettes d\'entit\u00e9s et de notes agrandies sur le canvas Excalidraw (280x76) avec texte 18px et police sans-serif' },
        { type: 'fix', message: 'Export Word : correction du crash Invalid hex value sur la section timeline' },
        { type: 'fix', message: 'Export Word : les n\u0153uds timeline sont d\u00e9sormais inclus dans le pr\u00e9-chargement, \u00e9vitant les exports vides' },
        { type: 'fix', message: 'Ic\u00f4ne manquante pour les n\u0153uds timeline dans l\'arborescence (affichait Time sans ic\u00f4ne)' },
        { type: 'fix', message: 'Double pr\u00e9fixe mdi- corrig\u00e9 pour l\'ic\u00f4ne Note du TimelineEditor' },
        { type: 'improvement', message: 'Panneau Entit\u00e9s Excalidraw enti\u00e8rement repens\u00e9 : header indigo d\u00e9grad\u00e9, typographie lisible en mode clair ET sombre, inputs avec focus ring, layout \u00e9largi \u00e0 300px' },
        { type: 'improvement', message: 'Couleur du texte des vignettes sur canvas Excalidraw corrig\u00e9e pour \u00eatre lisible sur fond blanc' },
        { type: 'improvement', message: 'Consolidation de 17 composants utilisant des d\u00e9finitions de plateformes sociales dupliqu\u00e9es vers une source unique (socialIconMap.ts)' },
        { type: 'improvement', message: 'Migration de 6 composants (SocialSessionManager, AdminOsint, ProfileAnalyzer, MediaDownloader, OsintIndustriesImportDialog, UsernameScanDialog) vers le composant SocialIcon centralis\u00e9' },
      ],
    },
    {
      version: '3.12.0',
      entries: [
        { type: 'feature', message: 'Phone Scanner : nouvel outil OSINT pour d\u00e9tecter les comptes WhatsApp depuis un num\u00e9ro complet ou partiel (avec masques ?)' },
        { type: 'feature', message: 'G\u00e9n\u00e9ration automatique de combinaisons depuis un masque (?), avec seuils anti-explosion (50/200) configurables' },
        { type: 'feature', message: 'Pairage WhatsApp Web par utilisateur via QR code (whatsapp-web.js multi-user) — sessions stock\u00e9es par profil dans Sessions sociales' },
        { type: 'feature', message: 'Approche hybride A+B : v\u00e9rification rapide via wa.me (Phase B) puis enrichissement profil (nom, photo, about) via WA Web (Phase A)' },
        { type: 'feature', message: 'Cr\u00e9ation automatique d\'entit\u00e9 dans le dossier depuis un r\u00e9sultat de scan' },
        { type: 'feature', message: 'Historique des scans persistant par dossier, consultable et r\u00e9utilisable' },
        { type: 'feature', message: 'Rate limiting anti-ban : quotas quotidiens globaux et par utilisateur, d\u00e9lais al\u00e9atoires gaussiens entre requ\u00e8tes (45-90s)' },
        { type: 'feature', message: 'Page admin Phone Scanner : configuration des limites, statistiques live, top utilisateurs' },
        { type: 'feature', message: 'Section Sessions sociales d\u00e9sormais accessible depuis le profil utilisateur (le menu manquait)' },
        { type: 'fix', message: '3 bugs critiques du SocialSessionManager corrig\u00e9s : enum SocialCookie align\u00e9 (10 plateformes au lieu de 7), defaults coh\u00e9rents, auto-d\u00e9tection cookie file \u00e9tendue' },
        { type: 'improvement', message: 'Mod\u00e8le SocialCookie \u00e9tendu avec sessionMode et whatsappWebSession par utilisateur' },
        { type: 'improvement', message: 'Audit logging sur toutes les actions Phone Scanner (start, complete, cancel, entity.create, settings.update, pairing)' },
      ],
    },
  ];
  for (const v of versions) {
    const exists = await Changelog.findOne({ version: v.version });
    if (!exists) {
      await Changelog.create(v);
      console.log(`[SEED] Changelog created for ${v.version}`);
    }
  }
}

async function start() {
  await connectDB();
  const existingSettings = await SiteSettings.findOne();
  if (!existingSettings) {
    await SiteSettings.create({});
    console.log('SiteSettings initialized');
  }
  await seedDefaultAdmin();
  await seedChangelog();
  await loadMaintenanceState();
  await detectOsintTools();
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  const yjsPort = parseInt(process.env.YJS_PORT || '3002');
  startYjsServer(yjsPort);
  startTrashPurgeJob();
}

start().catch(console.error);

export default app;

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
import { setupSocket } from './socket';
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
  origin: allowedOrigins || true,
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

setupSocket(httpServer);

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

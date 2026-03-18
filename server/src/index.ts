import express from 'express';
import { createServer } from 'http';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';

const execFileAsync = promisify(execFile);
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
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
import setupRoutes from './routes/setup';
import SiteSettings from './models/SiteSettings';
import User from './models/User';
import { startYjsServer } from './yjs-server';
import { checkMaintenance, loadMaintenanceState } from './middleware/maintenance';
import { startTrashPurgeJob } from './jobs/trashPurge';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

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
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// Branding files - public (logos, favicons, login backgrounds)
app.use('/uploads/branding', express.static(path.join(__dirname, '..', process.env.UPLOAD_DIR || './uploads', 'branding')));
// All other uploads: served with .enc fallback (sensitive files are E2E encrypted — the encryption IS the security layer)
import { serveUploadFile } from './controllers/fileController';
app.get('/uploads/*filepath', serveUploadFile);

// Swagger API documentation (public, no auth required)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'MeteorEdit API Documentation',
}));
app.get('/api-docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Extension download — public, before any auth middleware
app.get('/api/social/extension-download', async (_req, res) => {
  try {
    const archiver = await import('archiver');
    const extDir = path.resolve(__dirname, '..', 'extension');
    const fs2 = await import('fs');
    if (!fs2.existsSync(extDir)) {
      res.status(404).json({ message: 'Extension not found' });
      return;
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="meteoredit-cookie-bridge.zip"');
    const archive = archiver.default('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    archive.directory(extDir, 'meteoredit-cookie-bridge');
    archive.finalize();
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to create zip' });
  }
});

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

async function start() {
  await connectDB();
  const existingSettings = await SiteSettings.findOne();
  if (!existingSettings) {
    await SiteSettings.create({});
    console.log('SiteSettings initialized');
  }
  await seedDefaultAdmin();
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

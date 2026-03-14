import express from 'express';
import { createServer } from 'http';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import dotenv from 'dotenv';
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
import encryptionRoutes from './routes/encryption';
import evidenceRoutes from './routes/evidence';
import SiteSettings from './models/SiteSettings';
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

// Branding files - public
app.use('/uploads/branding', express.static(path.join(__dirname, '..', process.env.UPLOAD_DIR || './uploads', 'branding')));
// Legacy fallback - serve all uploads statically (will be removed after migration)
app.use('/uploads', express.static(path.join(__dirname, '..', process.env.UPLOAD_DIR || './uploads')));

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
app.use('/api/encryption', encryptionRoutes);
app.use('/api', evidenceRoutes);

setupSocket(httpServer);

async function start() {
  await connectDB();
  const existingSettings = await SiteSettings.findOne();
  if (!existingSettings) {
    await SiteSettings.create({});
    console.log('SiteSettings initialized');
  }
  await loadMaintenanceState();
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  const yjsPort = parseInt(process.env.YJS_PORT || '3002');
  startYjsServer(yjsPort);
  startTrashPurgeJob();
}

start().catch(console.error);

export default app;

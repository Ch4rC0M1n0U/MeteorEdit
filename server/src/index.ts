import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import dotenv from 'dotenv';
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
import SiteSettings from './models/SiteSettings';
import { startYjsServer } from './yjs-server';
import { checkMaintenance, loadMaintenanceState } from './middleware/maintenance';

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
app.use(express.json({ limit: '10mb' }));

app.use('/uploads', express.static(path.join(__dirname, '..', process.env.UPLOAD_DIR || './uploads')));

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
}

start().catch(console.error);

export default app;

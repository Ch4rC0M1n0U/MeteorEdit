import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import SiteSettings from '../models/SiteSettings';
import { logActivity } from '../utils/activityLogger';

const LT_URL = process.env.LANGUAGETOOL_URL || '';
const OLLAMA_URL = process.env.OLLAMA_URL || '';

interface ServiceCheck {
  name: string;
  status: 'ok' | 'error' | 'unconfigured';
  message: string;
  version?: string;
}

async function checkMongoDB(): Promise<ServiceCheck> {
  try {
    const state = mongoose.connection.readyState;
    if (state === 1) {
      const admin = mongoose.connection.db!.admin();
      const info = await admin.serverInfo();
      return { name: 'mongodb', status: 'ok', message: 'Connected', version: info.version };
    }
    return { name: 'mongodb', status: 'error', message: `Connection state: ${state}` };
  } catch (e: any) {
    return { name: 'mongodb', status: 'error', message: e.message || 'Connection failed' };
  }
}

async function checkLanguageTool(): Promise<ServiceCheck> {
  if (!LT_URL) return { name: 'languagetool', status: 'unconfigured', message: 'LANGUAGETOOL_URL not set' };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${LT_URL}/v2/languages`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const langs = await res.json();
      return { name: 'languagetool', status: 'ok', message: `${langs.length} languages available` };
    }
    return { name: 'languagetool', status: 'error', message: `HTTP ${res.status}` };
  } catch (e: any) {
    return { name: 'languagetool', status: 'error', message: e.message || 'Unreachable' };
  }
}

async function checkOllama(): Promise<ServiceCheck> {
  const url = OLLAMA_URL || 'http://localhost:11434';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${url}/api/version`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      return { name: 'ollama', status: 'ok', message: 'Connected', version: data.version };
    }
    return { name: 'ollama', status: 'error', message: `HTTP ${res.status}` };
  } catch {
    if (!OLLAMA_URL) return { name: 'ollama', status: 'unconfigured', message: 'OLLAMA_URL not set, default unreachable' };
    return { name: 'ollama', status: 'error', message: 'Unreachable' };
  }
}

async function checkYjs(): Promise<ServiceCheck> {
  const port = process.env.YJS_PORT || '3002';
  return { name: 'yjs', status: 'ok', message: `WebSocket server on port ${port}` };
}

async function checkUploadsDir(): Promise<ServiceCheck> {
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const resolved = path.resolve(__dirname, '..', '..', uploadDir);
    await fs.access(resolved);
    const stat = await fs.stat(resolved);
    if (stat.isDirectory()) {
      // Test write
      const testFile = path.join(resolved, '.write-test');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      return { name: 'uploads', status: 'ok', message: `Writable: ${resolved}` };
    }
    return { name: 'uploads', status: 'error', message: `Not a directory: ${resolved}` };
  } catch (e: any) {
    return { name: 'uploads', status: 'error', message: e.message || 'Cannot access uploads directory' };
  }
}

export async function getSetupStatus(req: Request, res: Response): Promise<void> {
  try {
    const isDev = req.query.dev === 'true';

    // Check if setup already done (admin exists)
    const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
    const userCount = await User.countDocuments();
    const setupRequired = adminCount === 0;

    // Run service diagnostics
    const [mongodb, languagetool, ollama, yjs, uploads] = await Promise.all([
      checkMongoDB(),
      checkLanguageTool(),
      checkOllama(),
      checkYjs(),
      checkUploadsDir(),
    ]);

    const services = [mongodb, languagetool, ollama, yjs, uploads];
    const settings = await SiteSettings.findOne();

    res.json({
      setupRequired,
      isDev,
      stats: {
        adminCount,
        userCount,
        hasSettings: !!settings,
      },
      services,
      env: {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: process.env.PORT || '3001',
        yjsPort: process.env.YJS_PORT || '3002',
        hasJwtSecret: !!process.env.JWT_SECRET && process.env.JWT_SECRET !== 'CHANGE_ME_GENERATE_A_SECURE_SECRET' && process.env.JWT_SECRET !== 'dev-secret-change-in-production',
        hasRefreshSecret: !!process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET !== 'CHANGE_ME_GENERATE_A_SECURE_SECRET' && process.env.JWT_REFRESH_SECRET !== 'dev-refresh-secret-change-in-production',
        hasCookieKey: !!process.env.COOKIE_ENCRYPTION_KEY && process.env.COOKIE_ENCRYPTION_KEY !== 'CHANGE_ME_GENERATE_A_SECURE_SECRET',
        uploadDir: process.env.UPLOAD_DIR || './uploads',
        mongodbUri: process.env.MONGODB_URI ? process.env.MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') : 'not set',
        languagetoolUrl: LT_URL || 'not set',
        ollamaUrl: OLLAMA_URL || 'not set',
      },
      version: '3.3.0-beta.1',
    });
  } catch (e: any) {
    res.status(500).json({ message: e.message || 'Setup status check failed' });
  }
}

export async function initialize(req: Request, res: Response): Promise<void> {
  try {
    const isDev = req.query.dev === 'true';
    const { admin, settings: settingsInput } = req.body;

    // Validate admin data
    if (!admin || !admin.email || !admin.password || !admin.firstName || !admin.lastName) {
      res.status(400).json({ message: 'Admin email, password, firstName, and lastName are required' });
      return;
    }

    if (admin.password.length < 8) {
      res.status(400).json({ message: 'Password must be at least 8 characters' });
      return;
    }

    // Dev mode: simulate without writing
    if (isDev) {
      const existingAdmin = await User.countDocuments({ role: 'admin', isActive: true });
      const existingUser = await User.findOne({ email: admin.email });

      res.json({
        success: true,
        isDev: true,
        simulation: {
          wouldCreateAdmin: !existingUser,
          wouldUpdateSettings: !!settingsInput,
          adminEmailConflict: !!existingUser,
          existingAdminCount: existingAdmin,
          settingsPreview: settingsInput || {},
        },
        message: 'Simulation completed — no changes made',
      });
      return;
    }

    // Real mode: check if setup already done
    const existingAdmin = await User.countDocuments({ role: 'admin', isActive: true });
    if (existingAdmin > 0) {
      res.status(409).json({ message: 'Setup already completed. An active admin already exists.' });
      return;
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: admin.email });
    if (existingUser) {
      res.status(400).json({ message: 'This email is already registered' });
      return;
    }

    // Create admin user
    const newAdmin = await User.create({
      email: admin.email,
      password: admin.password,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: 'admin',
      isActive: true,
    });

    // Update SiteSettings if provided
    if (settingsInput) {
      const updates: Record<string, any> = {};
      if (settingsInput.appName) updates.appName = settingsInput.appName;
      if (settingsInput.accentColor) updates.accentColor = settingsInput.accentColor;
      if (settingsInput.loginMessage) updates.loginMessage = settingsInput.loginMessage;
      if (typeof settingsInput.registrationEnabled === 'boolean') updates.registrationEnabled = settingsInput.registrationEnabled;
      if (settingsInput.language) updates['languageTool.defaultLanguage'] = settingsInput.language;

      if (Object.keys(updates).length > 0) {
        await SiteSettings.updateOne({}, { $set: updates }, { upsert: true });
      }
    }

    // Log setup activity
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    const ua = req.headers['user-agent'] || '';
    await logActivity(newAdmin._id.toString(), 'system.setup_completed', 'system', null, {
      adminEmail: newAdmin.email,
      settingsUpdated: !!settingsInput,
    }, ip, ua);

    res.json({
      success: true,
      isDev: false,
      message: 'Setup completed successfully',
      admin: {
        id: newAdmin._id,
        email: newAdmin.email,
        firstName: newAdmin.firstName,
        lastName: newAdmin.lastName,
        role: newAdmin.role,
      },
    });
  } catch (e: any) {
    res.status(500).json({ message: e.message || 'Setup initialization failed' });
  }
}

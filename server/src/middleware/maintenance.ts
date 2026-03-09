import { Request, Response, NextFunction } from 'express';
import SiteSettings from '../models/SiteSettings';
import { AuthRequest } from './auth';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

let maintenanceMode = false;
let maintenanceMessage = '';

export async function loadMaintenanceState() {
  try {
    const settings = await SiteSettings.findOne();
    maintenanceMode = !!settings?.maintenanceMode;
    maintenanceMessage = settings?.maintenanceMessage || 'Le site est en maintenance.';
  } catch {}
}

export function setMaintenanceState(enabled: boolean, message?: string) {
  maintenanceMode = enabled;
  if (message !== undefined) maintenanceMessage = message;
}

export function checkMaintenance(req: Request, res: Response, next: NextFunction): void {
  if (!maintenanceMode) { next(); return; }

  // Always allow: branding endpoint (for maintenance page display), admin routes
  if (req.path.startsWith('/settings/branding')) { next(); return; }

  // Check if user is admin — let admins through
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      if (decoded.role === 'admin') { next(); return; }
    } catch {}
  }

  // Allow login and refresh so admins can authenticate
  if (req.path === '/auth/login' || req.path === '/auth/refresh' || req.path === '/auth/2fa/validate') {
    next(); return;
  }

  res.status(503).json({ message: maintenanceMessage, maintenance: true });
}

import Notification from '../models/Notification';
import User from '../models/User';
import SiteSettings from '../models/SiteSettings';
import { INotification } from '../types';
import { getIO, getUserSockets } from '../socket';
import nodemailer from 'nodemailer';

// Email throttle: max 1 email per type per user per hour
const emailThrottle = new Map<string, number>();
const THROTTLE_MS = 60 * 60 * 1000;

function canSendEmail(userId: string, type: string): boolean {
  const key = `${userId}:${type}`;
  const last = emailThrottle.get(key);
  if (last && Date.now() - last < THROTTLE_MS) return false;
  emailThrottle.set(key, Date.now());
  return true;
}

async function sendNotificationEmail(userEmail: string, subject: string, text: string): Promise<void> {
  try {
    const settings = await SiteSettings.findOne().lean();
    if (!settings?.smtpHost || !settings?.smtpFrom) return;

    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort || 587,
      secure: settings.smtpSecure || false,
      auth: settings.smtpUser ? { user: settings.smtpUser, pass: settings.smtpPass || '' } : undefined,
    });

    await transporter.sendMail({
      from: settings.smtpFrom,
      to: userEmail,
      subject: `[${settings.appName || 'MeteorEdit'}] ${subject}`,
      text,
    });
  } catch (err) {
    console.error('Notification email error:', err);
  }
}

export async function createNotification(
  userId: string,
  type: INotification['type'],
  message: string,
  dossierId: string | null = null,
  fromUserId: string | null = null
): Promise<void> {
  try {
    // Check user notification preferences
    const user = await User.findById(userId).select('notificationPreferences email').lean();
    if (!user) return;

    const prefs = user.notificationPreferences || { inApp: {}, email: {}, doNotDisturb: false };

    // In-app notification (unless explicitly disabled for this type)
    const inAppEnabled = prefs.inApp?.[type] !== false;
    if (!inAppEnabled) return;

    const notification = await Notification.create({ userId, type, message, dossierId, fromUserId });
    const populated = await notification.populate('fromUserId', 'firstName lastName');

    // Socket.io push (unless do not disturb)
    if (!prefs.doNotDisturb) {
      const io = getIO();
      const sockets = getUserSockets().get(userId);
      if (io && sockets) {
        for (const socketId of sockets) {
          io.to(socketId).emit('notification:new', populated);
        }
      }
    }

    // Email notification (if enabled for this type and throttle allows)
    const emailEnabled = prefs.email?.[type] === true;
    if (emailEnabled && canSendEmail(userId, type)) {
      await sendNotificationEmail(user.email, message, message);
    }
  } catch (err) {
    console.error('Notification error:', err);
  }
}

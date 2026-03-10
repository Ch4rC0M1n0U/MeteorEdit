import ActivityLog from '../models/ActivityLog';

export async function logActivity(
  userId: string,
  action: string,
  targetType: 'dossier' | 'user' | 'system' | 'node',
  targetId: string | null,
  metadata: Record<string, any> = {},
  ip: string = '',
  userAgent: string = ''
): Promise<void> {
  try {
    await ActivityLog.create({ userId, action, targetType, targetId, metadata, ip, userAgent });
  } catch (err) {
    console.error('Activity log error:', err);
  }
}

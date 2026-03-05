import ActivityLog from '../models/ActivityLog';

export async function logActivity(
  userId: string,
  action: string,
  targetType: 'dossier' | 'user' | 'system',
  targetId: string | null,
  metadata: Record<string, any> = {},
  ip: string = ''
): Promise<void> {
  try {
    await ActivityLog.create({ userId, action, targetType, targetId, metadata, ip });
  } catch (err) {
    console.error('Activity log error:', err);
  }
}

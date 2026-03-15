import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Task from '../models/Task';
import Dossier from '../models/Dossier';
import User from '../models/User';
import { logActivity } from '../utils/activityLogger';
import { createNotification } from '../utils/notifier';

async function checkAccess(dossierId: string, userId: string): Promise<boolean> {
  const dossier = await Dossier.findById(dossierId);
  if (!dossier) return false;
  return dossier.owner.toString() === userId || dossier.collaborators.map(c => c.toString()).includes(userId);
}

async function isDossierEmbargo(dossierId: string): Promise<boolean> {
  const dossier = await Dossier.findById(dossierId).select('isEmbargo').lean();
  return !!dossier?.isEmbargo;
}

export async function listTasks(req: AuthRequest, res: Response): Promise<void> {
  const dossierId = req.params.dossierId as string;
  if (!(await checkAccess(dossierId, req.user!.userId))) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const tasks = await Task.find({ dossierId })
    .populate('assigneeId', 'firstName lastName email avatarPath')
    .populate('createdBy', 'firstName lastName')
    .sort({ createdAt: -1 });
  res.json(tasks);
}

export async function createTask(req: AuthRequest, res: Response): Promise<void> {
  const dossierId = req.params.dossierId as string;
  const userId = req.user!.userId;
  if (!(await checkAccess(dossierId, userId))) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }
  const { title, description, priority, assigneeId, dueDate } = req.body;
  const task = await Task.create({
    dossierId,
    title,
    description: description || '',
    priority: priority || 'medium',
    assigneeId: assigneeId || null,
    dueDate: dueDate || null,
    createdBy: userId,
  });

  const populated = await task.populate([
    { path: 'assigneeId', select: 'firstName lastName email avatarPath' },
    { path: 'createdBy', select: 'firstName lastName' },
  ]);

  if (!(await isDossierEmbargo(dossierId))) {
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(userId, 'task.create', 'dossier', dossierId, { taskId: task._id.toString(), title }, ip);
  }

  if (assigneeId && assigneeId !== userId) {
    const creator = await User.findById(userId);
    const creatorName = creator ? `${creator.firstName} ${creator.lastName}` : 'Quelqu\'un';
    await createNotification(
      assigneeId,
      'task.assigned',
      `${creatorName} vous a assigné la tâche "${title}"`,
      dossierId,
      userId,
    );
  }

  res.status(201).json(populated);
}

export async function updateTask(req: AuthRequest, res: Response): Promise<void> {
  const taskId = req.params.taskId as string;
  const userId = req.user!.userId;
  const task = await Task.findById(taskId);
  if (!task) { res.status(404).json({ error: 'Tâche introuvable' }); return; }
  if (!(await checkAccess(task.dossierId.toString(), userId))) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }

  const { title, description, status, priority, assigneeId, dueDate } = req.body;
  const oldAssignee = task.assigneeId?.toString() || null;
  const oldStatus = task.status;

  if (title !== undefined) task.title = title;
  if (description !== undefined) task.description = description;
  if (status !== undefined) {
    task.status = status;
    task.completedAt = status === 'done' ? new Date() : null;
  }
  if (priority !== undefined) task.priority = priority;
  if ('assigneeId' in req.body) task.assigneeId = assigneeId || null;
  if ('dueDate' in req.body) task.dueDate = dueDate || null;

  await task.save();

  // Capture IDs before populate transforms them into objects
  const newAssigneeId = task.assigneeId?.toString() || null;
  const dossierId = task.dossierId.toString();

  const populated = await task.populate([
    { path: 'assigneeId', select: 'firstName lastName email avatarPath' },
    { path: 'createdBy', select: 'firstName lastName' },
  ]);

  if (!(await isDossierEmbargo(dossierId))) {
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(userId, 'task.update', 'dossier', dossierId, { taskId, changes: req.body }, ip);
  }

  // Notify new assignee if changed
  if (newAssigneeId && newAssigneeId !== oldAssignee && newAssigneeId !== userId) {
    const actor = await User.findById(userId);
    const actorName = actor ? `${actor.firstName} ${actor.lastName}` : 'Quelqu\'un';
    await createNotification(
      newAssigneeId,
      'task.assigned',
      `${actorName} vous a assigné la tâche "${task.title}"`,
      dossierId,
      userId,
    );
  }

  // Notify assignee when status changed to done
  if (status === 'done' && oldStatus !== 'done' && newAssigneeId && newAssigneeId !== userId) {
    const actor = await User.findById(userId);
    const actorName = actor ? `${actor.firstName} ${actor.lastName}` : 'Quelqu\'un';
    await createNotification(
      newAssigneeId,
      'task.assigned',
      `${actorName} a terminé la tâche "${task.title}"`,
      dossierId,
      userId,
    );
  }

  res.json(populated);
}

export async function deleteTask(req: AuthRequest, res: Response): Promise<void> {
  const taskId = req.params.taskId as string;
  const userId = req.user!.userId;
  const task = await Task.findById(taskId);
  if (!task) { res.status(404).json({ error: 'Tâche introuvable' }); return; }
  if (!(await checkAccess(task.dossierId.toString(), userId))) {
    res.status(403).json({ error: 'Accès refusé' });
    return;
  }

  if (!(await isDossierEmbargo(task.dossierId.toString()))) {
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || '').replace('::ffff:', '');
    await logActivity(userId, 'task.delete', 'dossier', task.dossierId.toString(), { taskId, title: task.title }, ip);
  }

  await task.deleteOne();
  res.json({ ok: true });
}

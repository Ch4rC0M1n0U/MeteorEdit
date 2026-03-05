import { Response } from 'express';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';

export async function listUsers(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function updateUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { isActive, role } = req.body;
    const update: any = {};
    if (typeof isActive === 'boolean') update.isActive = isActive;
    if (role && ['admin', 'user'].includes(role)) update.role = role;

    const user = await User.findByIdAndUpdate(id, update, { new: true }).select('-password');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

export async function deleteUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (id === req.user!.userId) {
      res.status(400).json({ message: 'Cannot delete yourself' });
      return;
    }
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

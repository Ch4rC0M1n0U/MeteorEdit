import { Response } from 'express';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';

export async function searchUsers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const q = (req.query.q as string || '').trim();
    if (q.length < 2) { res.json([]); return; }
    const users = await User.find({
      isActive: true,
      _id: { $ne: req.user!.userId },
      $or: [
        { email: { $regex: q, $options: 'i' } },
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
      ],
    }).select('firstName lastName email').limit(10);
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
}

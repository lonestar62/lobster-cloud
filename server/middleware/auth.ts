import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'lobster-secret';

export interface AuthRequest extends Request {
  user?: { id: string; email: string };
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): any => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const adminMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): any => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Admin access required' });
  }

  // Simple static token check
  if (token === (process.env.ADMIN_TOKEN || 'lobster-admin-token')) {
    return next();
  }

  // JWT with admin role
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role === 'admin') return next();
  } catch {}

  return res.status(401).json({ error: 'Admin access required' });
};

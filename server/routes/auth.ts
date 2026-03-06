import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'lobster-secret';

// In-memory fallback when DB is unavailable
const mockUsers = new Map<string, any>();

router.post('/register', async (req: Request, res: Response): Promise<any> => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (email, password_hash, status, plan)
       VALUES ($1, $2, 'provisioning', 'free')
       RETURNING id, email, status, plan, created_at`,
      [email, passwordHash]
    );

    let user;
    if (result.rows.length > 0) {
      user = result.rows[0];
    } else {
      // DB unavailable — use in-memory store
      if (mockUsers.has(email)) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      const id = crypto.randomUUID();
      user = { id, email, status: 'provisioning', plan: 'free', created_at: new Date() };
      mockUsers.set(email, { ...user, password_hash: passwordHash });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '7d',
    });
    return res.json({
      token,
      user: { id: user.id, email: user.email, status: user.status, plan: user.plan },
    });
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    return res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req: Request, res: Response): Promise<any> => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);

    let user;
    if (result.rows.length > 0) {
      user = result.rows[0];
    } else if (mockUsers.has(email)) {
      user = mockUsers.get(email);
    } else {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '7d',
    });
    return res.json({
      token,
      user: { id: user.id, email: user.email, status: user.status, plan: user.plan },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const result = await query(
      'SELECT id, email, status, plan, gcs_path, soul_config, created_at FROM users WHERE id = $1',
      [req.user?.id]
    );

    if (result.rows.length > 0) {
      return res.json(result.rows[0]);
    }
  } catch {}

  // Fallback from JWT payload
  return res.json({
    id: req.user?.id,
    email: req.user?.email,
    status: 'active',
    plan: 'free',
    gcs_path: `gs://openclawai/users/${req.user?.id}/`,
  });
});

export default router;

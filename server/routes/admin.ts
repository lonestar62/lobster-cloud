import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { adminMiddleware } from '../middleware/auth';
import { query } from '../db';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'lobster-secret';

// --- Mock seed data (5 users + 5 nodes) ---

const MOCK_USERS = [
  {
    id: 'a1b2c3d4-0001-0001-0001-000000000001',
    email: 'alice@example.com',
    plan: 'pro',
    status: 'active',
    active_node: 'node-0001',
    last_seen: '2 min ago',
    created_at: '2024-01-15T09:00:00Z',
  },
  {
    id: 'a1b2c3d4-0002-0002-0002-000000000002',
    email: 'bob@deeptex.io',
    plan: 'free',
    status: 'provisioning',
    active_node: null,
    last_seen: '5 hrs ago',
    created_at: '2024-02-20T14:30:00Z',
  },
  {
    id: 'a1b2c3d4-0003-0003-0003-000000000003',
    email: 'carol@techfarm.net',
    plan: 'enterprise',
    status: 'active',
    active_node: 'node-0002',
    last_seen: '30 sec ago',
    created_at: '2024-01-08T11:15:00Z',
  },
  {
    id: 'a1b2c3d4-0004-0004-0004-000000000004',
    email: 'dave@nomad.ai',
    plan: 'pro',
    status: 'active',
    active_node: 'node-0003',
    last_seen: '1 min ago',
    created_at: '2024-03-01T08:45:00Z',
  },
  {
    id: 'a1b2c3d4-0005-0005-0005-000000000005',
    email: 'eve@cloudrunner.dev',
    plan: 'free',
    status: 'suspended',
    active_node: null,
    last_seen: '3 days ago',
    created_at: '2024-02-10T16:00:00Z',
  },
];

const MOCK_NODES = [
  {
    id: 'node-0001',
    user_id: 'a1b2c3d4-0001-0001-0001-000000000001',
    user_email: 'alice@example.com',
    node_type: 'gcp_vm',
    tailscale_ip: '100.64.1.1',
    public_url: 'https://agent-a1b2c3d4.deeptxai.com',
    gateway_port: 7777,
    status: 'active',
    last_seen: '2 min ago',
    specs: { cpu: '2 vCPU', ram: '4 GB', os: 'Ubuntu 22.04', region: 'us-central1' },
  },
  {
    id: 'node-0002',
    user_id: 'a1b2c3d4-0003-0003-0003-000000000003',
    user_email: 'carol@techfarm.net',
    node_type: 'pi',
    tailscale_ip: '100.64.1.3',
    public_url: null,
    gateway_port: 7777,
    status: 'active',
    last_seen: '30 sec ago',
    specs: { cpu: 'ARM Cortex-A72', ram: '8 GB', os: 'Raspberry Pi OS 12' },
  },
  {
    id: 'node-0003',
    user_id: 'a1b2c3d4-0004-0004-0004-000000000004',
    user_email: 'dave@nomad.ai',
    node_type: 'desktop',
    tailscale_ip: '100.64.1.4',
    public_url: null,
    gateway_port: 7777,
    status: 'active',
    last_seen: '1 min ago',
    specs: { cpu: 'Apple M3 Max', ram: '64 GB', os: 'macOS Sonoma 14.3' },
  },
  {
    id: 'node-0004',
    user_id: 'a1b2c3d4-0001-0001-0001-000000000001',
    user_email: 'alice@example.com',
    node_type: 'phone',
    tailscale_ip: '100.64.1.5',
    public_url: null,
    gateway_port: 7777,
    status: 'standby',
    last_seen: '2 hrs ago',
    specs: { model: 'iPhone 15 Pro', os: 'iOS 17.2' },
  },
  {
    id: 'node-0005',
    user_id: 'a1b2c3d4-0002-0002-0002-000000000002',
    user_email: 'bob@deeptex.io',
    node_type: 'gcp_vm',
    tailscale_ip: '100.64.1.2',
    public_url: null,
    gateway_port: 7777,
    status: 'offline',
    last_seen: '5 hrs ago',
    specs: { cpu: '1 vCPU', ram: '2 GB', os: 'Ubuntu 22.04', region: 'us-east1' },
  },
];

// POST /admin/login
router.post('/login', async (req: Request, res: Response): Promise<any> => {
  const { email, password } = req.body;
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@lobster.cloud';
  const adminPassword = process.env.ADMIN_PASSWORD || 'lobster-admin-2024';

  if (email === adminEmail && password === adminPassword) {
    const token = jwt.sign({ role: 'admin', email }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token, email });
  }
  return res.status(401).json({ error: 'Invalid admin credentials' });
});

// GET /admin/users
router.get('/users', adminMiddleware, async (_req: Request, res: Response): Promise<any> => {
  try {
    const result = await query(
      `SELECT
         u.id, u.email, u.plan, u.status, u.created_at,
         (SELECT n.id FROM nodes n WHERE n.user_id = u.id AND n.status = 'active' LIMIT 1) AS active_node,
         (SELECT n.last_seen FROM nodes n WHERE n.user_id = u.id ORDER BY n.last_seen DESC LIMIT 1) AS last_seen
       FROM users u ORDER BY u.created_at DESC`
    );
    if (result.rows.length > 0) return res.json(result.rows);
  } catch {}
  return res.json(MOCK_USERS);
});

// GET /admin/nodes
router.get('/nodes', adminMiddleware, async (_req: Request, res: Response): Promise<any> => {
  try {
    const result = await query(
      `SELECT n.*, u.email AS user_email
       FROM nodes n JOIN users u ON n.user_id = u.id
       ORDER BY n.last_seen DESC NULLS LAST`
    );
    if (result.rows.length > 0) return res.json(result.rows);
  } catch {}
  return res.json(MOCK_NODES);
});

// GET /admin/fleet — combined stats + users + nodes
router.get('/fleet', adminMiddleware, async (_req: Request, res: Response): Promise<any> => {
  let users = MOCK_USERS;
  let nodes = MOCK_NODES;

  try {
    const uResult = await query('SELECT id, email, plan, status, created_at FROM users');
    const nResult = await query(`SELECT n.*, u.email AS user_email FROM nodes n JOIN users u ON n.user_id = u.id`);
    if (uResult.rows.length > 0) users = uResult.rows;
    if (nResult.rows.length > 0) nodes = nResult.rows;
  } catch {}

  return res.json({
    stats: {
      total_users: users.length,
      active_agents: users.filter((u) => u.status === 'active').length,
      nodes_online: nodes.filter((n) => n.status === 'active').length,
      nodes_standby: nodes.filter((n) => n.status === 'standby').length,
      nodes_offline: nodes.filter((n) => n.status === 'offline').length,
    },
    users,
    nodes,
  });
});

export default router;

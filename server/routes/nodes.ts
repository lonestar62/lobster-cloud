import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { hlrGet, hlrSet } from '../redis';
import { query } from '../db';

const router = Router();

// POST /api/nodes/register — register a compute node for this user
router.post('/register', authMiddleware, async (req: AuthRequest, res: Response): Promise<any> => {
  const userId = req.user!.id;
  const { node_type, tailscale_ip, public_url, gateway_port, specs } = req.body;

  try {
    const result = await query(
      `INSERT INTO nodes (user_id, node_type, tailscale_ip, public_url, gateway_port, specs, status, last_seen)
       VALUES ($1, $2, $3, $4, $5, $6, 'online', NOW())
       RETURNING *`,
      [
        userId,
        node_type || 'desktop',
        tailscale_ip || null,
        public_url || null,
        gateway_port || 7777,
        JSON.stringify(specs || {}),
      ]
    );

    let node;
    if (result.rows.length > 0) {
      node = result.rows[0];
    } else {
      // Mock fallback
      node = {
        id: crypto.randomUUID(),
        user_id: userId,
        node_type: node_type || 'desktop',
        tailscale_ip,
        public_url,
        gateway_port: gateway_port || 7777,
        status: 'online',
        last_seen: new Date(),
        specs: specs || {},
        created_at: new Date(),
      };
    }

    // Track in HLR
    const nodesKey = `user:${userId}:nodes`;
    const existing = await hlrGet(nodesKey);
    const nodes = existing ? JSON.parse(existing) : [];
    if (!nodes.includes(node.id)) nodes.push(node.id);
    await hlrSet(nodesKey, JSON.stringify(nodes));

    return res.json({ success: true, node });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to register node' });
  }
});

// POST /api/nodes/heartbeat — keep-alive ping from a node
router.post('/heartbeat', authMiddleware, async (req: AuthRequest, res: Response): Promise<any> => {
  const userId = req.user!.id;
  const { node_id, status } = req.body;

  if (!node_id) {
    return res.status(400).json({ error: 'node_id required' });
  }

  try {
    await query(
      `UPDATE nodes SET last_seen = NOW(), status = $1 WHERE id = $2 AND user_id = $3`,
      [status || 'online', node_id, userId]
    );

    // Update HLR location ping if this node is the active gateway
    const locationRaw = await hlrGet(`user:${userId}:location`);
    if (locationRaw) {
      const loc = JSON.parse(locationRaw);
      if (loc.node_id === node_id) {
        loc.last_ping = new Date().toISOString();
        await hlrSet(`user:${userId}:location`, JSON.stringify(loc), 86400);
      }
    }

    return res.json({ success: true, timestamp: new Date().toISOString() });
  } catch {
    return res.json({ success: true, timestamp: new Date().toISOString() });
  }
});

// GET /api/nodes — list nodes for current user
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<any> => {
  const userId = req.user!.id;

  try {
    const result = await query(
      `SELECT id, node_type, tailscale_ip, public_url, gateway_port, status, last_seen, specs, created_at
       FROM nodes WHERE user_id = $1 ORDER BY last_seen DESC`,
      [userId]
    );

    if (result.rows.length > 0) {
      return res.json(result.rows);
    }
  } catch {}

  // Mock demo nodes
  return res.json([
    {
      id: 'demo-node-001',
      node_type: 'gcp_vm',
      tailscale_ip: '100.64.1.10',
      public_url: null,
      status: 'online',
      last_seen: new Date().toISOString(),
      specs: { cpu: '2 vCPU', ram: '4 GB', os: 'Ubuntu 22.04' },
    },
  ]);
});

export default router;

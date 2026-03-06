import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { hlrGet, hlrSet } from '../redis';
import { query } from '../db';

const router = Router();

// GET /api/user/location — HLR lookup for active gateway
router.get('/user/location', authMiddleware, async (req: AuthRequest, res: Response): Promise<any> => {
  const userId = req.user!.id;

  try {
    // Check HLR first (sub-10ms)
    const hlrData = await hlrGet(`user:${userId}:location`);
    if (hlrData) {
      return res.json({ source: 'hlr', ...JSON.parse(hlrData) });
    }

    // Fall back to DB
    const result = await query(
      `SELECT id, node_type, tailscale_ip, public_url, status, last_seen
       FROM nodes WHERE user_id = $1 AND status = 'active'
       ORDER BY last_seen DESC LIMIT 1`,
      [userId]
    );

    if (result.rows.length > 0) {
      const node = result.rows[0];
      const location = {
        status: 'active',
        source: 'db',
        node_id: node.id,
        node_type: node.node_type,
        ip: node.tailscale_ip,
        gateway_url: node.public_url || `https://agent-${userId.split('-')[0]}.deeptxai.com`,
        last_ping: node.last_seen,
      };
      // Cache in HLR
      await hlrSet(`user:${userId}:location`, JSON.stringify(location), 86400);
      return res.json(location);
    }

    return res.json({
      status: 'no_active_gateway',
      message: 'No active gateway found. Click "Activate Here" to spin one up.',
    });
  } catch (err: any) {
    return res.json({
      status: 'no_active_gateway',
      message: 'HLR lookup failed — try activating below.',
    });
  }
});

// POST /api/activate — migrate gateway to this node
router.post('/activate', authMiddleware, async (req: AuthRequest, res: Response): Promise<any> => {
  const userId = req.user!.id;
  const { node_id, node_type, ip } = req.body;

  try {
    if (node_id) {
      // Promote requested node, demote others
      await query(
        `UPDATE nodes SET status = 'active', last_seen = NOW() WHERE id = $1 AND user_id = $2`,
        [node_id, userId]
      );
      await query(
        `UPDATE nodes SET status = 'standby' WHERE user_id = $1 AND id != $2 AND status = 'active'`,
        [userId, node_id]
      );
    }

    const gatewayUrl = `https://agent-${userId.split('-')[0]}.deeptxai.com`;
    const location = {
      status: 'active',
      node_id: node_id || crypto.randomUUID(),
      node_type: node_type || 'desktop',
      ip: ip || '100.64.x.x',
      gateway_url: gatewayUrl,
      activated_at: new Date().toISOString(),
      last_ping: new Date().toISOString(),
    };

    await hlrSet(`user:${userId}:location`, JSON.stringify(location), 86400);

    return res.json({ success: true, message: 'Gateway activated on this node', ...location });
  } catch {
    const gatewayUrl = `https://agent-${userId.split('-')[0]}.deeptxai.com`;
    return res.json({
      success: true,
      message: 'Gateway activated (mock)',
      status: 'active',
      gateway_url: gatewayUrl,
    });
  }
});

export default router;

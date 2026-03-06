import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
  id: string;
  email: string;
  status: string;
  plan: string;
  gcs_path?: string;
}

interface Location {
  status: string;
  node_id?: string;
  node_type?: string;
  ip?: string;
  gateway_url?: string;
  last_ping?: string;
  message?: string;
}

interface Node {
  id: string;
  node_type: string;
  tailscale_ip?: string;
  public_url?: string;
  status: string;
  last_seen?: string;
  specs?: Record<string, string>;
}

const NODE_ICONS: Record<string, string> = {
  gcp_vm: '☁️',
  desktop: '🖥️',
  phone: '📱',
  pi: '🥧',
  laptop: '💻',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-400',
  provisioning: 'text-yellow-400',
  suspended: 'text-red-400',
  online: 'text-green-400',
  standby: 'text-blue-400',
  offline: 'text-zinc-500',
  no_active_gateway: 'text-zinc-500',
};

function authHeaders() {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [activating, setActivating] = useState(false);
  const [activateMsg, setActivateMsg] = useState('');

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const loadData = useCallback(async () => {
    try {
      const [meRes, locRes, nodesRes] = await Promise.all([
        fetch('/api/me', { headers: authHeaders() }),
        fetch('/api/user/location', { headers: authHeaders() }),
        fetch('/api/nodes', { headers: authHeaders() }),
      ]);

      if (meRes.status === 401) { logout(); return; }

      if (meRes.ok) setUser(await meRes.json());
      if (locRes.ok) setLocation(await locRes.json());
      if (nodesRes.ok) setNodes(await nodesRes.json());
    } catch {
      // Server may not be running — show demo state
      setUser({ id: 'demo', email: 'demo@lobster.cloud', status: 'active', plan: 'pro' });
      setLocation({ status: 'no_active_gateway', message: 'Server offline — demo mode' });
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleActivate = async () => {
    setActivating(true);
    setActivateMsg('');
    try {
      const res = await fetch('/api/activate', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ node_type: 'desktop' }),
      });
      const data = await res.json();
      setActivateMsg(data.message || 'Activated!');
      await loadData();
    } catch {
      setActivateMsg('Activation failed — check server connection');
    } finally {
      setActivating(false);
    }
  };

  const isActive = location?.status === 'active';

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Top nav */}
      <header className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🦞</span>
            <span className="font-semibold text-white tracking-tight">Lobster Cloud</span>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <span className="text-zinc-400 text-sm hidden sm:block">{user.email}</span>
            )}
            <span className="text-xs px-2 py-1 bg-orange-500/20 text-orange-400 rounded-full font-medium capitalize">
              {user?.plan || 'free'}
            </span>
            <button
              onClick={logout}
              className="text-zinc-500 hover:text-white text-sm transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Status row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Agent status */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <p className="text-zinc-500 text-xs uppercase tracking-widest mb-2">Agent Status</p>
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  user?.status === 'active' ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'
                }`}
              />
              <span className={`text-lg font-semibold capitalize ${STATUS_COLORS[user?.status || ''] || 'text-white'}`}>
                {user?.status || 'Loading…'}
              </span>
            </div>
            {user?.gcs_path && (
              <p className="text-zinc-600 text-xs mt-2 font-mono truncate">{user.gcs_path}</p>
            )}
          </div>

          {/* Active node / gateway */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <p className="text-zinc-500 text-xs uppercase tracking-widest mb-2">Active Gateway</p>
            {isActive ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{NODE_ICONS[location?.node_type || ''] || '🌐'}</span>
                  <span className="text-lg font-semibold text-white capitalize">{location?.node_type}</span>
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                </div>
                {location?.ip && (
                  <p className="text-zinc-500 text-sm font-mono mt-1">{location.ip}</p>
                )}
                {location?.gateway_url && (
                  <a
                    href={location.gateway_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-orange-400 text-xs hover:underline mt-1 block truncate"
                  >
                    {location.gateway_url}
                  </a>
                )}
              </>
            ) : (
              <p className="text-zinc-500 text-sm">{location?.message || 'No active gateway'}</p>
            )}
          </div>
        </div>

        {/* Activate button */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-white font-medium">Activate Here</p>
              <p className="text-zinc-500 text-sm mt-0.5">
                Move your agent gateway to this device
              </p>
            </div>
            <button
              onClick={handleActivate}
              disabled={activating}
              className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium rounded-xl px-6 py-2.5 text-sm transition-colors"
            >
              {activating ? 'Activating…' : '⚡ Activate'}
            </button>
          </div>
          {activateMsg && (
            <div className="mt-3 text-sm text-green-400 bg-green-950/50 border border-green-900 rounded-lg px-3 py-2">
              {activateMsg}
            </div>
          )}
        </div>

        {/* Chat iframe placeholder */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-zinc-800">
            <span className="text-orange-500 text-lg">💬</span>
            <p className="text-white font-medium">Gateway Chat</p>
            {isActive && (
              <span className="ml-auto text-xs text-green-400 bg-green-950 border border-green-900 px-2 py-0.5 rounded-full">
                Connected
              </span>
            )}
          </div>
          {isActive && location?.gateway_url ? (
            <iframe
              src={location.gateway_url}
              className="w-full h-96 bg-zinc-950"
              title="Gateway Chat"
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          ) : (
            <div className="h-96 flex flex-col items-center justify-center text-zinc-600 gap-3">
              <div className="text-4xl">🦞</div>
              <p className="text-sm">No active gateway</p>
              <p className="text-xs text-zinc-700">Activate your agent to start chatting</p>
            </div>
          )}
        </div>

        {/* Nodes table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <p className="text-white font-medium">Registered Nodes</p>
            <span className="text-xs text-zinc-500">{nodes.length} device{nodes.length !== 1 ? 's' : ''}</span>
          </div>
          {nodes.length === 0 ? (
            <div className="py-12 text-center text-zinc-600 text-sm">
              No nodes registered yet.<br />
              <span className="text-zinc-700 text-xs">Install OpenClaw on a device to register it.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-zinc-500 text-xs uppercase tracking-wider">
                    <th className="text-left px-5 py-3">Type</th>
                    <th className="text-left px-5 py-3">Tailscale IP</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-left px-5 py-3">Last Seen</th>
                    <th className="text-left px-5 py-3">Specs</th>
                  </tr>
                </thead>
                <tbody>
                  {nodes.map((node) => (
                    <tr key={node.id} className="border-t border-zinc-800/60 hover:bg-zinc-800/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span>{NODE_ICONS[node.node_type] || '🌐'}</span>
                          <span className="text-white capitalize">{node.node_type}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-zinc-400 font-mono">
                        {node.tailscale_ip || '—'}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`capitalize ${STATUS_COLORS[node.status] || 'text-zinc-400'}`}>
                          {node.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-zinc-500">
                        {node.last_seen
                          ? new Date(node.last_seen).toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-5 py-3 text-zinc-500 text-xs">
                        {node.specs
                          ? Object.entries(node.specs)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(' · ')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

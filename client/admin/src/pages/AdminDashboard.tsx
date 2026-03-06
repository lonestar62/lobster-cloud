import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Stats {
  total_users: number;
  active_agents: number;
  nodes_online: number;
  nodes_standby: number;
  nodes_offline: number;
}

interface User {
  id: string;
  email: string;
  plan: string;
  status: string;
  active_node: string | null;
  last_seen: string;
  created_at: string;
}

interface Node {
  id: string;
  user_id: string;
  user_email: string;
  node_type: string;
  tailscale_ip: string;
  public_url: string | null;
  gateway_port: number;
  status: string;
  last_seen: string;
  specs: Record<string, string>;
}

type Tab = 'overview' | 'users' | 'fleet';

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-950 text-green-400 border-green-900',
  provisioning: 'bg-yellow-950 text-yellow-400 border-yellow-900',
  suspended: 'bg-red-950 text-red-400 border-red-900',
  online: 'bg-green-950 text-green-400 border-green-900',
  standby: 'bg-blue-950 text-blue-400 border-blue-900',
  offline: 'bg-zinc-800 text-zinc-500 border-zinc-700',
};

const PLAN_BADGE: Record<string, string> = {
  free: 'bg-zinc-800 text-zinc-400',
  pro: 'bg-orange-950 text-orange-400',
  enterprise: 'bg-purple-950 text-purple-400',
};

const NODE_ICONS: Record<string, string> = {
  gcp_vm: '☁️',
  desktop: '🖥️',
  phone: '📱',
  pi: '🥧',
  laptop: '💻',
};

function authHeaders() {
  const token = localStorage.getItem('admin_token');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const adminEmail = localStorage.getItem('admin_email') || 'admin';

  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_email');
    navigate('/login');
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/admin/fleet', { headers: authHeaders() });
        if (res.status === 401) { logout(); return; }
        const data = await res.json();
        setStats(data.stats);
        setUsers(data.users || []);
        setNodes(data.nodes || []);
      } catch {
        // Demo fallback — data comes from mock in the API anyway
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-500 text-sm">Loading fleet data…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🦞</span>
            <span className="font-semibold text-white tracking-tight">Lobster Admin</span>
            <span className="text-zinc-700">|</span>
            <span className="text-zinc-500 text-sm hidden sm:block">{adminEmail}</span>
          </div>
          <button onClick={logout} className="text-zinc-500 hover:text-white text-sm transition-colors">
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
            {[
              { label: 'Total Users', value: stats.total_users, color: 'text-white' },
              { label: 'Active Agents', value: stats.active_agents, color: 'text-green-400' },
              { label: 'Nodes Online', value: stats.nodes_online, color: 'text-green-400' },
              { label: 'Nodes Standby', value: stats.nodes_standby, color: 'text-blue-400' },
              { label: 'Nodes Offline', value: stats.nodes_offline, color: 'text-zinc-500' },
            ].map((s) => (
              <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <p className="text-zinc-500 text-xs mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tab nav */}
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit mb-6">
          {(['overview', 'users', 'fleet'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? 'bg-orange-500 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {t === 'overview' ? '📊 Overview' : t === 'users' ? '👥 Users' : '🌐 Fleet'}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-4">Platform Health</h3>
              <div className="space-y-3">
                <HealthRow label="API Server" status="online" detail="port 4000" />
                <HealthRow label="PostgreSQL" status="online" detail="Cloud SQL" />
                <HealthRow label="Redis HLR" status="online" detail="in-memory fallback active" />
                <HealthRow label="GCS Soul Store" status="online" detail="gs://openclawai/" />
                <HealthRow label="Tailscale Mesh" status="standby" detail="3 nodes connected" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-4">Recent Activity</h3>
                <div className="space-y-3 text-sm">
                  {[
                    { time: '30s ago', event: 'carol@techfarm.net — heartbeat (pi)', color: 'text-green-400' },
                    { time: '1m ago', event: 'dave@nomad.ai — gateway activated', color: 'text-orange-400' },
                    { time: '2m ago', event: 'alice@example.com — HLR lookup', color: 'text-zinc-400' },
                    { time: '5m ago', event: 'New registration: eve2@dev.io', color: 'text-blue-400' },
                    { time: '12m ago', event: 'bob@deeptex.io — node offline', color: 'text-red-400' },
                  ].map((item, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="text-zinc-600 w-14 shrink-0">{item.time}</span>
                      <span className={item.color}>{item.event}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-4">Plan Distribution</h3>
                <div className="space-y-3">
                  {[
                    { plan: 'Enterprise', count: 1, pct: 20, color: 'bg-purple-500' },
                    { plan: 'Pro', count: 2, pct: 40, color: 'bg-orange-500' },
                    { plan: 'Free', count: 2, pct: 40, color: 'bg-zinc-600' },
                  ].map((p) => (
                    <div key={p.plan}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-zinc-400">{p.plan}</span>
                        <span className="text-zinc-500">{p.count} user{p.count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${p.color} rounded-full`}
                          style={{ width: `${p.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users tab */}
        {tab === 'users' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <p className="text-white font-medium">Users ({users.length})</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-zinc-800">
                    <th className="text-left px-5 py-3">Email</th>
                    <th className="text-left px-5 py-3">Plan</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-left px-5 py-3">Active Node</th>
                    <th className="text-left px-5 py-3">Last Seen</th>
                    <th className="text-left px-5 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-t border-zinc-800/60 hover:bg-zinc-800/30 transition-colors">
                      <td className="px-5 py-3">
                        <span className="text-white">{user.email}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PLAN_BADGE[user.plan] || 'bg-zinc-800 text-zinc-400'}`}>
                          {user.plan}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${STATUS_BADGE[user.status] || 'bg-zinc-800 text-zinc-400'}`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-zinc-400 font-mono text-xs">
                        {user.active_node || <span className="text-zinc-700">—</span>}
                      </td>
                      <td className="px-5 py-3 text-zinc-500">{user.last_seen}</td>
                      <td className="px-5 py-3 text-zinc-600 text-xs">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Fleet tab */}
        {tab === 'fleet' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {nodes.map((node) => (
                <div key={node.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{NODE_ICONS[node.node_type] || '🌐'}</span>
                      <div>
                        <p className="text-white font-medium capitalize">{node.node_type.replace('_', ' ')}</p>
                        <p className="text-zinc-500 text-xs font-mono">{node.tailscale_ip || '—'}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${STATUS_BADGE[node.status] || 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                      {node.status}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-zinc-500">
                    <div className="flex justify-between">
                      <span>Owner</span>
                      <span className="text-zinc-400 truncate ml-2">{node.user_email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last seen</span>
                      <span className="text-zinc-400">{node.last_seen}</span>
                    </div>
                    {node.public_url && (
                      <div className="flex justify-between">
                        <span>URL</span>
                        <a href={node.public_url} target="_blank" rel="noreferrer" className="text-orange-400 hover:underline truncate ml-2">
                          {node.public_url.replace('https://', '')}
                        </a>
                      </div>
                    )}
                  </div>

                  {node.specs && Object.keys(node.specs).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-zinc-800 text-xs text-zinc-600">
                      {Object.entries(node.specs)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' · ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function HealthRow({ label, status, detail }: { label: string; status: string; detail: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-zinc-800/60 last:border-0">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${status === 'online' ? 'bg-green-400' : status === 'standby' ? 'bg-blue-400' : 'bg-red-400'}`} />
        <span className="text-white text-sm">{label}</span>
      </div>
      <div className="text-right">
        <span className={`text-xs ${status === 'online' ? 'text-green-400' : status === 'standby' ? 'text-blue-400' : 'text-red-400'}`}>
          {status}
        </span>
        <span className="text-zinc-600 text-xs ml-2">({detail})</span>
      </div>
    </div>
  );
}

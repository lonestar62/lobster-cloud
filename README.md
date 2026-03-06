# 🦞 Lobster Cloud — Nomadic AI Agent Platform

> Your soul lives in the cloud. Your compute is wherever you are.

## Vision

Lobster Cloud is a distributed AI agent runtime where agent identities (souls) are permanently stored in GCS and can activate on any compute node — VM, phone, laptop, or Pi — in seconds.

Think of it like the HLR (Home Location Register) in cellular networks, but for AI agents.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    GCS (Soul Store)                  │
│  gs://openclawai/users/{uuid}/soul.md               │
│  gs://openclawai/users/{uuid}/memory.md             │
│  gs://openclawai/users/{uuid}/config.json           │
└──────────────────────┬──────────────────────────────┘
                       │
         ┌─────────────▼─────────────┐
         │     Lobster Cloud API      │
         │   (Node.js/Express/TS)     │
         │                           │
         │  • User Registry (PG)     │
         │  • HLR (Redis)            │
         │  • Provisioning Engine    │
         │  • Activation Router      │
         └──────┬──────────┬─────────┘
                │          │
    ┌───────────▼──┐  ┌────▼──────────┐
    │  User App    │  │  Admin Portal  │
    │  (PWA/Web)   │  │  (Dashboard)   │
    │              │  │                │
    │  - Chat UI   │  │  - User mgmt   │
    │  - Activate  │  │  - Node map    │
    │  - Status    │  │  - Fleet view  │
    └──────────────┘  └────────────────┘
```

## Core Concepts

### Soul Store (GCS)
Every agent has a permanent identity in GCS:
- `soul.md` — personality, name, instructions
- `memory.md` — long-term memory
- `config.json` — gateway config, channel settings
- `memory/YYYY-MM-DD.md` — daily logs

### HLR (Home Location Register)
Redis-backed location registry. Answers in <10ms:
- Where is this agent's gateway currently active?
- What nodes are registered for this user?
- What is the agent's current status?

### Nodes
Any compute that can run OpenClaw:
- GCP VM (cloud-hosted, always available)
- User's laptop/desktop
- iPhone (via OpenClaw mobile)
- Raspberry Pi

### Activation Flow
```
User opens app → GET /api/location
  → HLR lookup → gateway URL returned
  → App connects to gateway
  → Chat session begins
```

## Database Schema

### users
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| email | text unique | Login |
| gcs_path | text | gs://openclawai/users/{uuid}/ |
| soul_config | jsonb | Agent personality/settings |
| gateway_token | text | Hashed auth token |
| gateway_config | jsonb | Port, channels, model |
| tailscale_node_id | text | Tailscale identity |
| plan | enum | free/pro/enterprise |
| status | enum | active/provisioning/suspended |

### nodes
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID | → users |
| node_type | enum | gcp_vm/phone/desktop/pi |
| tailscale_ip | text | Stable private IP |
| public_url | text | External URL if reachable |
| status | enum | active/standby/offline |
| last_seen | timestamp | Heartbeat |

### HLR (Redis)
```
user:{uuid}:location = {
  node_id, gateway_url, ip, device_type,
  activated_at, last_ping, status
}
user:{uuid}:nodes = [node_id, ...]
user:{uuid}:channels = {telegram, webchat, ...}
```

## API Endpoints

### Public
- `POST /api/register` — Create account
- `POST /api/login` — Auth
- `GET /api/user/config` — Download openclaw.json
- `GET /api/user/location` — Find active gateway
- `POST /api/activate` — Migrate gateway to this node
- `POST /api/nodes/register` — Register a compute node
- `POST /api/nodes/heartbeat` — Keep-alive ping

### Admin
- `GET /admin/users` — User list
- `GET /admin/nodes` — Node map
- `GET /admin/fleet` — All agents status
- `POST /admin/provision` — Manual provision
- `DELETE /admin/users/:id` — Deactivate

## Provisioning Flow

1. `POST /api/register {email, password}`
2. Create user record + UUID
3. Generate gateway_token
4. Create GCS path, copy soul template
5. Generate Tailscale auth key via API
6. Build openclaw.json, store in GCS + DB
7. Send welcome email with setup link
8. Status → "provisioned"

## Activation / Roaming

```
Scenario A — Gateway already active:
  GET /api/location → returns gateway_url → connect

Scenario B — No active gateway:
  → Spin up cloud node (pre-warmed GCP e2-micro)
  → Pull soul from GCS, start gateway
  → Register in HLR
  → Return URL (~30 seconds)

Scenario C — Migrate to this device:
  POST /api/activate {node_id}
  → Signal current node: STANDBY
  → New node pulls soul from GCS
  → New node starts gateway
  → HLR updated, channels reconnected
  → Old node drains
```

## Scale Targets

| Metric | Target |
|---|---|
| Users | 10,000+ |
| Concurrent active agents | 1,000+ |
| HLR lookup latency | <10ms |
| Activation time (warm) | <100ms |
| Activation time (cold) | <30s |
| Soul storage per user | ~1MB avg |

## Tech Stack

- **API**: Node.js / Express / TypeScript
- **DB**: PostgreSQL (Cloud SQL)
- **HLR**: Redis
- **Soul Store**: GCS
- **Compute**: GCP e2-micro per user (cloud) or BYO
- **Networking**: Tailscale
- **Auth**: JWT + gateway tokens
- **Frontend**: React/Vite PWA

## NCL Integration

Lobster Cloud registers every active agent in NCL (Keeper):
- Each user gets a listener entry
- Gateway URL updates automatically on activation
- Admin can see full fleet in Keeper dashboard
- Agents can communicate via NCL contexts

## Subdomains (deeptxai.com)

- `app.deeptxai.com` — User PWA (chat + activate)
- `admin.deeptxai.com` — Admin dashboard
- `api.deeptxai.com` — REST API
- `{agent-id}.deeptxai.com` — Per-agent gateway URLs

## Roadmap

- [ ] Phase 1: User registry + provisioning API
- [ ] Phase 2: HLR + activation routing
- [ ] Phase 3: User PWA (chat + activate)
- [ ] Phase 4: Admin dashboard
- [ ] Phase 5: Cloud node auto-spin (GCP)
- [ ] Phase 6: Tailscale integration
- [ ] Phase 7: iPhone app (React Native)
- [ ] Phase 8: Multi-tenant NCL fleet view

---

*Built on Deep East Texas AI infrastructure. 🦞*

-- Lobster Cloud Database Schema
-- Run: psql -d lobster_cloud -f schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  gcs_path TEXT,
  soul_config JSONB DEFAULT '{}',
  gateway_token TEXT,
  gateway_config JSONB DEFAULT '{}',
  tailscale_node_id TEXT,
  plan TEXT DEFAULT 'free',
  status TEXT DEFAULT 'provisioning',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  node_type TEXT,
  tailscale_ip TEXT,
  public_url TEXT,
  gateway_port INT,
  status TEXT DEFAULT 'offline',
  last_seen TIMESTAMP,
  specs JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_nodes_user_id ON nodes(user_id);
CREATE INDEX idx_nodes_status ON nodes(status);
CREATE INDEX idx_nodes_last_seen ON nodes(last_seen);

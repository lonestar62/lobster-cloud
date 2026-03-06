import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// In-memory fallback — used when Redis is unavailable
const memStore = new Map<string, { value: string; expiresAt?: number }>();

let client: Redis | null = null;

if (process.env.REDIS_URL) {
  try {
    client = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
    });

    client.on('connect', () => console.log('[HLR] Redis connected'));
    client.on('error', (err) => {
      console.warn('[HLR] Redis unavailable, using in-memory fallback:', err.message);
      client = null;
    });
  } catch (err: any) {
    console.warn('[HLR] Redis init failed:', err.message);
    client = null;
  }
} else {
  console.log('[HLR] REDIS_URL not set — using in-memory HLR fallback');
}

// --- HLR interface ---

export const hlrGet = async (key: string): Promise<string | null> => {
  if (client) {
    try {
      return await client.get(key);
    } catch {
      // fall through
    }
  }
  const entry = memStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    memStore.delete(key);
    return null;
  }
  return entry.value;
};

export const hlrSet = async (
  key: string,
  value: string,
  ttlSeconds?: number
): Promise<void> => {
  if (client) {
    try {
      if (ttlSeconds) {
        await client.setex(key, ttlSeconds, value);
      } else {
        await client.set(key, value);
      }
      return;
    } catch {
      // fall through to memory
    }
  }
  memStore.set(key, {
    value,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
  });
};

export const hlrDel = async (key: string): Promise<void> => {
  if (client) {
    try {
      await client.del(key);
    } catch {}
  }
  memStore.delete(key);
};

export const hlrKeys = async (pattern: string): Promise<string[]> => {
  if (client) {
    try {
      return await client.keys(pattern);
    } catch {}
  }
  const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
  return Array.from(memStore.keys()).filter((k) => regex.test(k));
};

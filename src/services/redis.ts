// ─── src/services/redis.ts ────────────────────────────────────────────────────
// Client Redis centralisé — cache, blacklist JWT, sessions
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, RedisClientType } from 'redis';

let client: RedisClientType | null = null;

export async function getRedis(): Promise<RedisClientType | null> {
  if (!process.env.REDIS_URL) return null;

  if (!client) {
    client = createClient({ url: process.env.REDIS_URL }) as RedisClientType;

    client.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
    });

    client.on('connect', () => {
      console.log('✅ Redis connecté');
    });

    try {
      await client.connect();
    } catch (err) {
      console.warn('⚠️  Redis indisponible — mode dégradé (pas de cache)');
      client = null;
    }
  }

  return client;
}

// ── Cache générique ────────────────────────────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = await getRedis();
  if (!redis) return null;
  try {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch { /* graceful degradation */ }
}

export async function cacheDel(key: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch { /* graceful degradation */ }
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(keys);
  } catch { /* graceful degradation */ }
}

// ── Blacklist JWT révoqués ────────────────────────────────────────────────────

export async function blacklistToken(token: string, ttlSeconds: number): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  try {
    await redis.set(`blacklist:${token}`, '1', { EX: ttlSeconds });
  } catch { /* graceful degradation */ }
}

export async function isTokenBlacklisted(token: string): Promise<boolean> {
  const redis = await getRedis();
  if (!redis) return false;
  try {
    return (await redis.exists(`blacklist:${token}`)) === 1;
  } catch {
    return false;
  }
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────

export async function disconnectRedis(): Promise<void> {
  if (client) {
    try {
      await client.quit();
    } catch { /* ignore */ }
    client = null;
  }
}
